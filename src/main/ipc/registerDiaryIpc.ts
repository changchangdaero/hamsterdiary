import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import type { DiaryComfortResponse, DiaryEntry, SaveDiaryPayload } from '../../shared/types/diary'
import { diaryStore } from '../stores/diaryStore'
import { createDiaryComfort } from '../services/geminiDiaryComfort'

interface Options {
  getTrustedWindows: () => Array<BrowserWindow | null>
  openDiary: (date?: string) => void
  closeDiary: () => void
  diaryChanged: (dates: string[]) => void
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const diaryKey = (date: string): string => `diary:${date}`
const listDates = (): string[] =>
  Object.keys(diaryStore.store)
    .filter((key) => key.startsWith('diary:'))
    .map((key) => key.slice('diary:'.length))
    .sort()

const parseDate = (value: unknown): string => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new Error('날짜 형식이 올바르지 않습니다.')
  }
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new Error('존재하지 않는 날짜입니다.')
  }
  return value
}

export const registerDiaryIpc = (options: Options): (() => void) => {
  const assertTrusted = (event: IpcMainInvokeEvent): void => {
    const trusted = options.getTrustedWindows().some(
      (window) =>
        window !== null && !window.isDestroyed() && event.sender === window.webContents
    )
    if (!trusted) throw new Error('허용되지 않은 일기 요청입니다.')
  }

  ipcMain.handle(IPC_CHANNELS.getDiary, (event, rawDate: unknown) => {
    assertTrusted(event)
    const date = parseDate(rawDate)
    return diaryStore.get(diaryKey(date)) ?? null
  })
  ipcMain.handle(IPC_CHANNELS.listDiaryDates, (event) => {
    assertTrusted(event)
    return listDates()
  })
  ipcMain.handle(IPC_CHANNELS.saveDiary, (event, rawPayload: unknown) => {
    assertTrusted(event)
    if (typeof rawPayload !== 'object' || rawPayload === null) {
      throw new Error('저장할 일기를 확인해 주세요.')
    }
    const payload = rawPayload as Partial<SaveDiaryPayload>
    const date = parseDate(payload.date)
    if (typeof payload.text !== 'string') {
      throw new Error('일기 내용이 올바르지 않습니다.')
    }
    const key = diaryKey(date)
    const text = payload.text.trim()
    if (text.length === 0) {
      diaryStore.delete(key)
      options.diaryChanged(listDates())
      return null
    }
    const entry: DiaryEntry = {
      date,
      text,
      updatedAt: new Date().toISOString()
    }
    diaryStore.set(key, entry)
    options.diaryChanged(listDates())
    return entry
  })
  ipcMain.handle(IPC_CHANNELS.comfortDiary, async (event, rawDate: unknown) => {
    assertTrusted(event)
    const date = parseDate(rawDate)
    const entry = diaryStore.get(diaryKey(date))
    if (!entry?.text.trim()) {
      return {
        status: 'empty',
        reply: '오늘은 아직 안 썼네? 한 줄이라도 남겨봐, 내가 읽어줄게.'
      } satisfies DiaryComfortResponse
    }
    const reply = await createDiaryComfort(date, entry.text)
    diaryStore.set(diaryKey(date), {
      ...entry,
      hamsterReply: reply,
      comfortedAt: new Date().toISOString()
    })
    return {
      status: 'ok',
      reply
    } satisfies DiaryComfortResponse
  })
  ipcMain.handle(IPC_CHANNELS.openDiary, (event, rawDate?: unknown) => {
    assertTrusted(event)
    options.openDiary(rawDate === undefined ? undefined : parseDate(rawDate))
  })
  ipcMain.handle(IPC_CHANNELS.closeDiary, (event) => {
    assertTrusted(event)
    options.closeDiary()
  })

  return () => {
    for (const channel of [
      IPC_CHANNELS.getDiary,
      IPC_CHANNELS.listDiaryDates,
      IPC_CHANNELS.saveDiary,
      IPC_CHANNELS.comfortDiary,
      IPC_CHANNELS.openDiary,
      IPC_CHANNELS.closeDiary
    ]) ipcMain.removeHandler(channel)
  }
}
