// 저장된 일정과 반복 리마인더를 로컬 타이머로 관리하는 main 알림 엔진입니다.
import type { Schedule } from '../../shared/types/schedule'
import {
  DEFAULT_REMINDER_SETTINGS,
  type ReminderKind,
  type ReminderSettings
} from '../../shared/types/notifications'
import { schedulesStore, settingsStore } from '../stores'
import {
  createRepeatingReminderMessage,
  createScheduleReminderMessage
} from './notificationMessages'

export const DEFAULT_SCHEDULE_REMINDER_MINUTES = 10
export const REMINDER_SNOOZE_MINUTES = 10
const MAXIMUM_TIMER_DELAY = 2_147_000_000
const MIDNIGHT_REFRESH_OFFSET = 1_000

export interface PetNotificationRequest {
  kind: 'schedule' | ReminderKind
  title: string
  message: string
  showOsNotification: boolean
}

interface NotificationSchedulerOptions {
  notify: (request: PetNotificationRequest) => void
  now?: () => Date
  isFocusActive?: () => boolean
}

export const isWithinQuietHours = (
  date: Date,
  settings: ReminderSettings
): boolean => {
  const quiet = settings.quietHours
  if (!quiet.enabled || quiet.startHour === quiet.endHour) {
    return false
  }
  const hour = date.getHours()
  return quiet.startHour < quiet.endHour
    ? hour >= quiet.startHour && hour < quiet.endHour
    : hour >= quiet.startHour || hour < quiet.endHour
}

export const shouldSkipRepeatingReminder = (
  date: Date,
  settings: ReminderSettings,
  isFocusActive: boolean
): boolean => isFocusActive || isWithinQuietHours(date, settings)

const nextMidnight = (date: Date): Date =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
    0,
    0,
    0,
    MIDNIGHT_REFRESH_OFFSET
  )

const resolveSettings = (): ReminderSettings =>
  settingsStore.get('reminders') ?? DEFAULT_REMINDER_SETTINGS

export class NotificationScheduler {
  private readonly notify: NotificationSchedulerOptions['notify']
  private readonly now: () => Date
  private readonly isFocusActive: () => boolean
  private readonly scheduleTimers = new Map<string, NodeJS.Timeout>()
  private readonly repeatingTimers = new Map<ReminderKind, NodeJS.Timeout>()
  private readonly mutedUntil = new Map<ReminderKind, number>()
  private midnightTimer: NodeJS.Timeout | null = null
  private unsubscribeSchedules: (() => void) | null = null
  private unsubscribeSettings: (() => void) | null = null

  constructor(options: NotificationSchedulerOptions) {
    this.notify = options.notify
    this.now = options.now ?? (() => new Date())
    this.isFocusActive = options.isFocusActive ?? (() => false)
  }

  start(): void {
    this.unsubscribeSchedules = schedulesStore.onDidChange(
      'schedules',
      () => this.rescheduleSchedules()
    )
    this.unsubscribeSettings = settingsStore.onDidChange(
      'reminders',
      () => this.rescheduleRepeating()
    )
    this.rescheduleSchedules()
    this.rescheduleRepeating()
    this.scheduleMidnightRefresh()
  }

  rescheduleSchedules(): void {
    for (const timer of this.scheduleTimers.values()) {
      clearTimeout(timer)
    }
    this.scheduleTimers.clear()

    const now = this.now().getTime()
    for (const schedule of schedulesStore.get('schedules')) {
      if (schedule.status === 'completed') {
        continue
      }
      const minutesBefore = Number.isFinite(schedule.reminderMinutesBefore)
        ? schedule.reminderMinutesBefore
        : DEFAULT_SCHEDULE_REMINDER_MINUTES
      const notifyAt =
        new Date(schedule.startAt).getTime() - minutesBefore * 60_000
      const delay = notifyAt - now
      if (delay <= 0 || delay > MAXIMUM_TIMER_DELAY) {
        continue
      }
      const timer = setTimeout(
        () => this.fireSchedule(schedule, minutesBefore),
        delay
      )
      timer.unref()
      this.scheduleTimers.set(schedule.id, timer)
    }
  }

  rescheduleRepeating(): void {
    for (const timer of this.repeatingTimers.values()) {
      clearTimeout(timer)
    }
    this.repeatingTimers.clear()
    this.scheduleRepeating('water')
    this.scheduleRepeating('stretch')
  }

  snooze(kind: ReminderKind): void {
    this.clearRepeatingTimer(kind)
    this.scheduleRepeatingAfter(kind, REMINDER_SNOOZE_MINUTES * 60_000)
  }

  muteForToday(kind: ReminderKind): void {
    this.clearRepeatingTimer(kind)
    this.mutedUntil.set(kind, nextMidnight(this.now()).getTime())
  }

  dispose(): void {
    for (const timer of this.scheduleTimers.values()) {
      clearTimeout(timer)
    }
    for (const timer of this.repeatingTimers.values()) {
      clearTimeout(timer)
    }
    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer)
      this.midnightTimer = null
    }
    this.scheduleTimers.clear()
    this.repeatingTimers.clear()
    this.unsubscribeSchedules?.()
    this.unsubscribeSettings?.()
    this.unsubscribeSchedules = null
    this.unsubscribeSettings = null
  }

  private fireSchedule(schedule: Schedule, minutesBefore: number): void {
    this.scheduleTimers.delete(schedule.id)
    this.notify({
      kind: 'schedule',
      title: '다가오는 일정',
      message: createScheduleReminderMessage(schedule, minutesBefore),
      showOsNotification: true
    })
  }

  private scheduleRepeating(kind: ReminderKind): void {
    const preference = resolveSettings()[kind]
    if (!preference.enabled) {
      return
    }
    const mutedUntil = this.mutedUntil.get(kind) ?? 0
    if (mutedUntil > this.now().getTime()) {
      return
    }
    this.mutedUntil.delete(kind)
    this.scheduleRepeatingAfter(kind, preference.intervalMinutes * 60_000)
  }

  private scheduleRepeatingAfter(kind: ReminderKind, delay: number): void {
    const timer = setTimeout(() => {
      this.repeatingTimers.delete(kind)
      this.fireRepeating(kind)
      this.scheduleRepeating(kind)
    }, delay)
    timer.unref()
    this.repeatingTimers.set(kind, timer)
  }

  private fireRepeating(kind: ReminderKind): void {
    const settings = resolveSettings()
    if (
      !settings[kind].enabled ||
      shouldSkipRepeatingReminder(
        this.now(),
        settings,
        this.isFocusActive()
      ) ||
      (this.mutedUntil.get(kind) ?? 0) > this.now().getTime()
    ) {
      return
    }
    this.notify({
      kind,
      title: kind === 'water' ? '물 마시기' : '스트레칭',
      message: createRepeatingReminderMessage(kind),
      showOsNotification: settings[kind].showOsNotification
    })
  }

  private clearRepeatingTimer(kind: ReminderKind): void {
    const timer = this.repeatingTimers.get(kind)
    if (timer) {
      clearTimeout(timer)
      this.repeatingTimers.delete(kind)
    }
  }

  private scheduleMidnightRefresh(): void {
    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer)
    }
    const delay = nextMidnight(this.now()).getTime() - this.now().getTime()
    this.midnightTimer = setTimeout(() => {
      this.mutedUntil.clear()
      this.rescheduleSchedules()
      this.rescheduleRepeating()
      this.scheduleMidnightRefresh()
    }, delay)
    this.midnightTimer.unref()
  }
}
