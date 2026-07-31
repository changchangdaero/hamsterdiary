// 반복 리마인더 설정과 다시 알림·오늘 그만 요청을 검증하는 IPC 파일입니다.
import {
  BrowserWindow,
  ipcMain,
  type IpcMainInvokeEvent
} from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import type {
  ReminderKind,
  ReminderSettings
} from '../../shared/types/notifications'
import { settingsStore } from '../stores'
import type { NotificationScheduler } from '../notifications/notificationScheduler'

interface RegisterReminderIpcOptions {
  getTrustedWindows: () => Array<BrowserWindow | null>
  scheduler: NotificationScheduler
}

const MINIMUM_INTERVAL_MINUTES = 1
const MAXIMUM_INTERVAL_MINUTES = 720

const isTrusted = (
  event: IpcMainInvokeEvent,
  options: RegisterReminderIpcOptions
): boolean =>
  options.getTrustedWindows().some(
    (window) =>
      window !== null &&
      !window.isDestroyed() &&
      event.sender === window.webContents
  )

const requireTrusted = (
  event: IpcMainInvokeEvent,
  options: RegisterReminderIpcOptions
): void => {
  if (!isTrusted(event, options)) {
    throw new Error('허용되지 않은 리마인더 요청입니다.')
  }
}

const parseKind = (value: unknown): ReminderKind => {
  if (
    typeof value !== 'object' ||
    value === null ||
    Object.keys(value).length !== 1
  ) {
    throw new Error('리마인더 종류를 확인해 주세요.')
  }
  const kind = (value as Record<string, unknown>).kind
  if (kind !== 'water' && kind !== 'stretch') {
    throw new Error('리마인더 종류를 확인해 주세요.')
  }
  return kind
}

const parsePreference = (
  value: unknown,
  label: string
): ReminderSettings['water'] => {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${label} 설정을 확인해 주세요.`)
  }
  const preference = value as Record<string, unknown>
  if (
    Object.keys(preference).length !== 3 ||
    typeof preference.enabled !== 'boolean' ||
    typeof preference.showOsNotification !== 'boolean' ||
    typeof preference.intervalMinutes !== 'number' ||
    !Number.isInteger(preference.intervalMinutes) ||
    preference.intervalMinutes < MINIMUM_INTERVAL_MINUTES ||
    preference.intervalMinutes > MAXIMUM_INTERVAL_MINUTES
  ) {
    throw new Error(`${label} 설정값이 올바르지 않습니다.`)
  }
  return {
    enabled: preference.enabled,
    intervalMinutes: preference.intervalMinutes,
    showOsNotification: preference.showOsNotification
  }
}

const parseSettings = (value: unknown): ReminderSettings => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('리마인더 설정을 확인해 주세요.')
  }
  const settings = value as Record<string, unknown>
  if (
    Object.keys(settings).length !== 3 ||
    !Object.hasOwn(settings, 'water') ||
    !Object.hasOwn(settings, 'stretch') ||
    !Object.hasOwn(settings, 'quietHours')
  ) {
    throw new Error('리마인더 설정 구조가 올바르지 않습니다.')
  }
  const quiet = settings.quietHours
  if (typeof quiet !== 'object' || quiet === null) {
    throw new Error('야간 무음 설정을 확인해 주세요.')
  }
  const quietRecord = quiet as Record<string, unknown>
  if (
    Object.keys(quietRecord).length !== 3 ||
    typeof quietRecord.enabled !== 'boolean' ||
    typeof quietRecord.startHour !== 'number' ||
    typeof quietRecord.endHour !== 'number' ||
    !Number.isInteger(quietRecord.startHour) ||
    !Number.isInteger(quietRecord.endHour) ||
    quietRecord.startHour < 0 ||
    quietRecord.startHour > 23 ||
    quietRecord.endHour < 0 ||
    quietRecord.endHour > 23
  ) {
    throw new Error('야간 무음 시간은 0시부터 23시 사이여야 합니다.')
  }
  return {
    water: parsePreference(settings.water, '물 마시기'),
    stretch: parsePreference(settings.stretch, '스트레칭'),
    quietHours: {
      enabled: quietRecord.enabled,
      startHour: quietRecord.startHour,
      endHour: quietRecord.endHour
    }
  }
}

export const registerReminderIpc = (
  options: RegisterReminderIpcOptions
): (() => void) => {
  ipcMain.handle(
    IPC_CHANNELS.getReminderSettings,
    (event, ...args): ReminderSettings => {
      requireTrusted(event, options)
      if (args.length !== 0) {
        throw new Error('설정 조회 요청이 올바르지 않습니다.')
      }
      return settingsStore.get('reminders')
    }
  )
  ipcMain.handle(
    IPC_CHANNELS.updateReminderSettings,
    (event, value, ...args): ReminderSettings => {
      requireTrusted(event, options)
      if (args.length !== 0) {
        throw new Error('설정 저장 요청이 올바르지 않습니다.')
      }
      const settings = parseSettings(value)
      settingsStore.set('reminders', settings)
      return settings
    }
  )
  ipcMain.handle(IPC_CHANNELS.snoozeReminder, (event, value, ...args) => {
    requireTrusted(event, options)
    if (args.length !== 0) {
      throw new Error('다시 알림 요청이 올바르지 않습니다.')
    }
    options.scheduler.snooze(parseKind(value))
  })
  ipcMain.handle(
    IPC_CHANNELS.muteReminderForToday,
    (event, value, ...args) => {
      requireTrusted(event, options)
      if (args.length !== 0) {
        throw new Error('오늘 그만 요청이 올바르지 않습니다.')
      }
      options.scheduler.muteForToday(parseKind(value))
    }
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.getReminderSettings)
    ipcMain.removeHandler(IPC_CHANNELS.updateReminderSettings)
    ipcMain.removeHandler(IPC_CHANNELS.snoozeReminder)
    ipcMain.removeHandler(IPC_CHANNELS.muteReminderForToday)
  }
}
