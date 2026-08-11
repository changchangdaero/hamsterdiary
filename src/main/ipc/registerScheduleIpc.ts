// 일정 데이터의 검증된 CRUD와 다이어리 열기 IPC를 처리하는 파일입니다.
import { randomUUID } from 'node:crypto'
import {
  BrowserWindow,
  ipcMain,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import type {
  Schedule,
  ScheduleDraft,
  ScheduleReminderMinutes
} from '../../shared/types/schedule'
import { schedulesStore } from '../stores'

interface RegisterScheduleIpcOptions {
  getTrustedWindows: () => Array<BrowserWindow | null>
  getScheduleDiaryWindow: () => BrowserWindow | null
  openScheduleDiary: (openNew: boolean, date?: string) => void
  scheduleDiaryReady: () => void
  schedulesChanged: (schedules: Schedule[]) => void
}

const REMINDERS: ScheduleReminderMinutes[] = [0, 5, 10, 30, 60]
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_PATTERN = /^(\d{2}):(\d{2})$/

class PublicScheduleError extends Error {}

const isTrustedSender = (
  event: IpcMainEvent | IpcMainInvokeEvent,
  options: RegisterScheduleIpcOptions
): boolean =>
  options.getTrustedWindows().some(
    (window) =>
      window !== null &&
      !window.isDestroyed() &&
      event.sender === window.webContents
  )

const requireTrustedSender = (
  event: IpcMainEvent | IpcMainInvokeEvent,
  options: RegisterScheduleIpcOptions
): void => {
  if (!isTrustedSender(event, options)) {
    throw new PublicScheduleError('허용되지 않은 일정 요청입니다.')
  }
}

const parseLocalStartAt = (date: unknown, time: unknown): string => {
  if (typeof date !== 'string' || typeof time !== 'string') {
    throw new PublicScheduleError('날짜와 시간을 확인해 주세요.')
  }

  const dateMatch = DATE_PATTERN.exec(date)
  const timeMatch = TIME_PATTERN.exec(time)
  if (!dateMatch || !timeMatch) {
    throw new PublicScheduleError('날짜와 시간 형식을 확인해 주세요.')
  }

  const [, rawYear, rawMonth, rawDay] = dateMatch
  const [, rawHour, rawMinute] = timeMatch
  const year = Number(rawYear)
  const month = Number(rawMonth)
  const day = Number(rawDay)
  const hour = Number(rawHour)
  const minute = Number(rawMinute)
  const localDate = new Date(year, month - 1, day, hour, minute, 0, 0)

  if (
    hour > 23 ||
    minute > 59 ||
    localDate.getFullYear() !== year ||
    localDate.getMonth() !== month - 1 ||
    localDate.getDate() !== day ||
    localDate.getHours() !== hour ||
    localDate.getMinutes() !== minute
  ) {
    throw new PublicScheduleError('실제로 존재하는 날짜와 시간을 입력해 주세요.')
  }

  return localDate.toISOString()
}

const parseOptionalDate = (value: unknown): string | undefined => {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string') {
    throw new PublicScheduleError('새 일정 날짜가 올바르지 않습니다.')
  }
  const match = DATE_PATTERN.exec(value)
  if (!match) {
    throw new PublicScheduleError('새 일정 날짜 형식을 확인해 주세요.')
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new PublicScheduleError('실제로 존재하는 날짜를 선택해 주세요.')
  }
  return value
}

const parseScheduleDraft = (value: unknown): ScheduleDraft & {
  startAt: string
} => {
  if (typeof value !== 'object' || value === null) {
    throw new PublicScheduleError('일정 입력값을 확인해 주세요.')
  }

  const draft = value as Record<string, unknown>
  const allowedKeys = [
    'title',
    'date',
    'time',
    'reminderMinutesBefore',
    'memo'
  ]
  if (
    Object.keys(draft).length !== allowedKeys.length ||
    !allowedKeys.every((key) => Object.hasOwn(draft, key))
  ) {
    throw new PublicScheduleError('일정 입력값의 구조를 확인해 주세요.')
  }
  if (typeof draft.title !== 'string') {
    throw new PublicScheduleError('제목을 입력해 주세요.')
  }
  const title = draft.title.trim()
  if (title.length === 0 || title.length > 80) {
    throw new PublicScheduleError('제목은 1자 이상 80자 이하로 입력해 주세요.')
  }
  if (
    typeof draft.reminderMinutesBefore !== 'number' ||
    !REMINDERS.includes(
      draft.reminderMinutesBefore as ScheduleReminderMinutes
    )
  ) {
    throw new PublicScheduleError('알림 시간을 다시 선택해 주세요.')
  }
  if (typeof draft.memo !== 'string' || draft.memo.length > 500) {
    throw new PublicScheduleError('메모는 500자 이하로 입력해 주세요.')
  }

  return {
    title,
    date: String(draft.date ?? ''),
    time: String(draft.time ?? ''),
    reminderMinutesBefore:
      draft.reminderMinutesBefore as ScheduleReminderMinutes,
    memo: draft.memo,
    startAt: parseLocalStartAt(draft.date, draft.time)
  }
}

const parseId = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > 100
  ) {
    throw new PublicScheduleError('일정 식별자가 올바르지 않습니다.')
  }
  return value
}

const sortedSchedules = (): Schedule[] =>
  [...schedulesStore.get('schedules')].sort((left, right) =>
    left.startAt.localeCompare(right.startAt)
  )

const writeSchedules = (schedules: Schedule[]): Schedule[] => {
  schedulesStore.set('schedules', schedules)
  return [...schedules].sort((left, right) =>
    left.startAt.localeCompare(right.startAt)
  )
}

export interface BatchScheduleResult {
  schedules: Schedule[]
  affected: Schedule[]
}

export const listStoredSchedules = (): Schedule[] => sortedSchedules()

const scheduleDateKey = (schedule: Schedule): string => {
  const date = new Date(schedule.startAt)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const listStoredSchedulesFiltered = (
  dateFrom?: unknown,
  dateTo?: unknown,
  query?: unknown
): Schedule[] => {
  const from = dateFrom === undefined ? undefined : parseOptionalDate(dateFrom)
  const to = dateTo === undefined ? undefined : parseOptionalDate(dateTo)
  if (from && to && from > to) {
    throw new PublicScheduleError('일정 조회 시작일이 종료일보다 늦습니다.')
  }
  if (query !== undefined && typeof query !== 'string') {
    throw new PublicScheduleError('일정 검색어가 올바르지 않습니다.')
  }
  const normalizedQuery = query?.trim().toLocaleLowerCase('ko-KR')
  const result = sortedSchedules().filter((schedule) => {
    const date = scheduleDateKey(schedule)
    return (
      (!from || date >= from) &&
      (!to || date <= to) &&
      (!normalizedQuery ||
        schedule.title.toLocaleLowerCase('ko-KR').includes(normalizedQuery))
    )
  })
  console.log('[schedule:list] function args', { dateFrom: from, dateTo: to, query })
  console.log('[schedule:list] store result', JSON.stringify(result, null, 2))
  return result
}

export const createStoredSchedule = (value: unknown): Schedule[] => {
  const draft = parseScheduleDraft(value)
  const now = new Date().toISOString()
  const schedule: Schedule = {
    id: randomUUID(),
    title: draft.title,
    startAt: draft.startAt,
    reminderMinutesBefore: draft.reminderMinutesBefore,
    memo: draft.memo,
    status: 'scheduled',
    createdAt: now,
    updatedAt: now
  }
  const updated = writeSchedules([...schedulesStore.get('schedules'), schedule])
  console.log('[schedule:create] function args', {
    title: draft.title,
    date: draft.date,
    time: draft.time
  })
  console.log('[schedule:create] store changed', { eventId: schedule.id })
  return updated
}

export const createStoredScheduleFromConversation = (
  title: unknown,
  date: unknown,
  time: unknown
): Schedule[] =>
  createStoredSchedule({
    title,
    date,
    time,
    reminderMinutesBefore: 10,
    memo: ''
  })

export const createStoredSchedulesFromConversation = (
  value: unknown
): BatchScheduleResult => {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new PublicScheduleError('일괄 일정은 1개 이상 20개 이하로 입력해 주세요.')
  }
  const drafts = value.map((item) => {
    if (typeof item !== 'object' || item === null) {
      throw new PublicScheduleError('일괄 일정 입력값을 확인해 주세요.')
    }
    const raw = item as Record<string, unknown>
    return parseScheduleDraft({
      title: raw.title,
      date: raw.date,
      time: raw.time,
      reminderMinutesBefore: 10,
      memo: ''
    })
  })
  const now = new Date().toISOString()
  const created: Schedule[] = drafts.map((draft) => ({
    id: randomUUID(),
    title: draft.title,
    startAt: draft.startAt,
    reminderMinutesBefore: draft.reminderMinutesBefore,
    memo: draft.memo,
    status: 'scheduled',
    createdAt: now,
    updatedAt: now
  }))
  const schedules = writeSchedules([
    ...schedulesStore.get('schedules'),
    ...created
  ])
  console.log('[schedule:create-batch] function args', {
    count: created.length,
    items: drafts.map(({ title, date, time }) => ({ title, date, time }))
  })
  console.log('[schedule:create-batch] store changed', {
    eventIds: created.map((schedule) => schedule.id)
  })
  return { schedules, affected: created }
}

export const deleteStoredScheduleById = (eventId: unknown): Schedule[] => {
  const id = parseId(String(eventId))
  const schedules = schedulesStore.get('schedules')
  console.log('[schedule:delete] function args', { eventId: id })
  console.log('[schedule:delete] store before', JSON.stringify(schedules, null, 2))
  if (!schedules.some((schedule) => String(schedule.id) === String(id))) {
    throw new PublicScheduleError('삭제할 일정을 찾지 못했습니다.')
  }
  const updated = writeSchedules(
    schedules.filter((schedule) => String(schedule.id) !== String(id))
  )
  console.log(
    '[schedule:delete] store after',
    JSON.stringify(schedulesStore.get('schedules'), null, 2)
  )
  return updated
}

export const deleteStoredSchedulesByIds = (
  eventIds: unknown
): BatchScheduleResult => {
  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    throw new PublicScheduleError('삭제할 일정 ID 목록이 비어 있습니다.')
  }
  const ids = [...new Set(eventIds.map((id) => parseId(String(id))))]
  const schedules = schedulesStore.get('schedules')
  const affected = schedules.filter((schedule) =>
    ids.some((id) => String(id) === String(schedule.id))
  )
  if (affected.length !== ids.length) {
    throw new PublicScheduleError('일괄 삭제할 일정 일부를 찾지 못했습니다.')
  }
  const idSet = new Set(ids.map(String))
  const updated = writeSchedules(
    schedules.filter((schedule) => !idSet.has(String(schedule.id)))
  )
  console.log('[schedule:delete-batch] function args', { eventIds: ids })
  console.log('[schedule:delete-batch] deleted', {
    count: affected.length,
    items: affected.map(({ id, title, startAt }) => ({ id, title, startAt }))
  })
  return { schedules: updated, affected }
}

export const deleteStoredSchedulesByRange = (
  dateFrom: unknown,
  dateTo: unknown,
  query?: unknown
): BatchScheduleResult => {
  const affected = listStoredSchedulesFiltered(dateFrom, dateTo, query)
  const idSet = new Set(affected.map((schedule) => String(schedule.id)))
  const updated =
    affected.length === 0
      ? sortedSchedules()
      : writeSchedules(
          schedulesStore
            .get('schedules')
            .filter((schedule) => !idSet.has(String(schedule.id)))
        )
  console.log('[schedule:delete-range] function args', {
    dateFrom,
    dateTo,
    query
  })
  console.log('[schedule:delete-range] deleted', {
    count: affected.length,
    items: affected.map(({ id, title, startAt }) => ({ id, title, startAt }))
  })
  return { schedules: updated, affected }
}

export const moveStoredScheduleById = (
  eventId: unknown,
  newDate: unknown,
  newTime: unknown
): Schedule[] => {
  const id = parseId(String(eventId))
  const startAt = parseLocalStartAt(newDate, newTime)
  const schedules = schedulesStore.get('schedules')
  console.log('[schedule:move] function args', {
    eventId: id,
    newDate,
    newTime
  })
  console.log('[schedule:move] store before', JSON.stringify(schedules, null, 2))
  if (!schedules.some((schedule) => String(schedule.id) === String(id))) {
    throw new PublicScheduleError('이동할 일정을 찾지 못했습니다.')
  }
  const updated = writeSchedules(
    schedules.map((schedule) =>
      String(schedule.id) === String(id)
        ? { ...schedule, startAt, updatedAt: new Date().toISOString() }
        : schedule
    )
  )
  console.log(
    '[schedule:move] store after',
    JSON.stringify(schedulesStore.get('schedules'), null, 2)
  )
  return updated
}

const safelyHandle = async <T>(operation: () => T): Promise<T> => {
  try {
    return operation()
  } catch (error) {
    if (error instanceof PublicScheduleError) {
      throw error
    }
    console.error('[schedule:request] 일정 요청 처리에 실패했습니다.')
    throw new Error('일정 요청을 처리하지 못했습니다.')
  }
}

export const registerScheduleIpc = (
  options: RegisterScheduleIpcOptions
): (() => void) => {
  const list = (
    event: IpcMainInvokeEvent,
    ...args: unknown[]
  ): Promise<Schedule[]> =>
    safelyHandle(() => {
      requireTrustedSender(event, options)
      if (args.length !== 0) {
        throw new PublicScheduleError('일정 목록 요청이 올바르지 않습니다.')
      }
      return sortedSchedules()
    })

  const create = (
    event: IpcMainInvokeEvent,
    value: unknown,
    ...args: unknown[]
  ): Promise<Schedule[]> =>
    safelyHandle(() => {
      requireTrustedSender(event, options)
      if (args.length !== 0) {
        throw new PublicScheduleError('일정 생성 요청이 올바르지 않습니다.')
      }
      const updated = createStoredSchedule(value)
      options.schedulesChanged(updated)
      return updated
    })

  const update = (
    event: IpcMainInvokeEvent,
    value: unknown,
    ...args: unknown[]
  ): Promise<Schedule[]> =>
    safelyHandle(() => {
      requireTrustedSender(event, options)
      if (typeof value !== 'object' || value === null) {
        throw new PublicScheduleError('수정할 일정을 확인해 주세요.')
      }
      const payload = value as Record<string, unknown>
      if (
        Object.keys(payload).length !== 2 ||
        !Object.hasOwn(payload, 'id') ||
        !Object.hasOwn(payload, 'draft') ||
        args.length !== 0
      ) {
        throw new PublicScheduleError('수정할 일정 입력값을 확인해 주세요.')
      }
      const id = parseId(payload.id)
      const draft = parseScheduleDraft(payload.draft)
      const schedules = schedulesStore.get('schedules')
      const index = schedules.findIndex((schedule) => schedule.id === id)
      if (index < 0) {
        throw new PublicScheduleError('수정할 일정을 찾지 못했습니다.')
      }
      const current = schedules[index]
      const updated: Schedule = {
        ...current,
        title: draft.title,
        startAt: draft.startAt,
        reminderMinutesBefore: draft.reminderMinutesBefore,
        memo: draft.memo,
        updatedAt: new Date().toISOString()
      }
      const result = writeSchedules(
        schedules.map((schedule) => (schedule.id === id ? updated : schedule))
      )
      console.log('[schedule:update] store changed', { eventId: id })
      options.schedulesChanged(result)
      return result
    })

  const remove = (
    event: IpcMainInvokeEvent,
    value: unknown,
    ...args: unknown[]
  ): Promise<Schedule[]> =>
    safelyHandle(() => {
      requireTrustedSender(event, options)
      if (args.length !== 0) {
        throw new PublicScheduleError('일정 삭제 요청이 올바르지 않습니다.')
      }
      const result = deleteStoredScheduleById(value)
      options.schedulesChanged(result)
      return result
    })

  const setCompleted = (
    event: IpcMainInvokeEvent,
    value: unknown,
    ...args: unknown[]
  ): Promise<Schedule[]> =>
    safelyHandle(() => {
      requireTrustedSender(event, options)
      if (typeof value !== 'object' || value === null) {
        throw new PublicScheduleError('완료 상태를 확인해 주세요.')
      }
      const payload = value as Record<string, unknown>
      if (
        Object.keys(payload).length !== 2 ||
        !Object.hasOwn(payload, 'id') ||
        !Object.hasOwn(payload, 'completed') ||
        args.length !== 0
      ) {
        throw new PublicScheduleError('완료 상태 입력값을 확인해 주세요.')
      }
      const id = parseId(payload.id)
      if (typeof payload.completed !== 'boolean') {
        throw new PublicScheduleError('완료 상태가 올바르지 않습니다.')
      }
      const schedules = schedulesStore.get('schedules')
      if (!schedules.some((schedule) => schedule.id === id)) {
        throw new PublicScheduleError('일정을 찾지 못했습니다.')
      }
      const result = writeSchedules(
        schedules.map((schedule) =>
          schedule.id === id
            ? {
                ...schedule,
                status: payload.completed ? 'completed' : 'scheduled',
                updatedAt: new Date().toISOString()
              }
            : schedule
        )
      )
      console.log('[schedule:complete] store changed', { eventId: id })
      options.schedulesChanged(result)
      return result
    })

  const openDiary = (
    event: IpcMainInvokeEvent,
    ...args: unknown[]
  ): Promise<void> =>
    safelyHandle(() => {
      requireTrustedSender(event, options)
      if (args.length !== 0) {
        throw new PublicScheduleError('창 열기 요청이 올바르지 않습니다.')
      }
      options.openScheduleDiary(false)
    })
  const openNew = (
    event: IpcMainInvokeEvent,
    dateValue: unknown,
    ...args: unknown[]
  ): Promise<void> =>
    safelyHandle(() => {
      requireTrustedSender(event, options)
      if (args.length !== 0) {
        throw new PublicScheduleError('새 일정 요청이 올바르지 않습니다.')
      }
      options.openScheduleDiary(true, parseOptionalDate(dateValue))
    })
  const ready = (event: IpcMainEvent, ...args: unknown[]): void => {
    const diaryWindow = options.getScheduleDiaryWindow()
    if (
      diaryWindow &&
      !diaryWindow.isDestroyed() &&
      event.sender === diaryWindow.webContents &&
      args.length === 0
    ) {
      options.scheduleDiaryReady()
    }
  }

  ipcMain.handle(IPC_CHANNELS.listSchedules, list)
  ipcMain.handle(IPC_CHANNELS.createSchedule, create)
  ipcMain.handle(IPC_CHANNELS.updateSchedule, update)
  ipcMain.handle(IPC_CHANNELS.deleteSchedule, remove)
  ipcMain.handle(IPC_CHANNELS.setScheduleCompleted, setCompleted)
  ipcMain.handle(IPC_CHANNELS.openScheduleDiary, openDiary)
  ipcMain.handle(IPC_CHANNELS.openNewSchedule, openNew)
  ipcMain.on(IPC_CHANNELS.scheduleDiaryReady, ready)

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.listSchedules)
    ipcMain.removeHandler(IPC_CHANNELS.createSchedule)
    ipcMain.removeHandler(IPC_CHANNELS.updateSchedule)
    ipcMain.removeHandler(IPC_CHANNELS.deleteSchedule)
    ipcMain.removeHandler(IPC_CHANNELS.setScheduleCompleted)
    ipcMain.removeHandler(IPC_CHANNELS.openScheduleDiary)
    ipcMain.removeHandler(IPC_CHANNELS.openNewSchedule)
    ipcMain.removeListener(IPC_CHANNELS.scheduleDiaryReady, ready)
  }
}
