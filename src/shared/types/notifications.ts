// 반복 리마인더 설정과 제어 요청에 사용하는 공용 타입을 정의하는 파일입니다.
export type ReminderKind = 'water' | 'stretch'

export interface RepeatingReminderPreference {
  enabled: boolean
  intervalMinutes: number
  showOsNotification: boolean
}

export interface QuietHoursPreference {
  enabled: boolean
  startHour: number
  endHour: number
}

export interface ReminderSettings {
  water: RepeatingReminderPreference
  stretch: RepeatingReminderPreference
  quietHours: QuietHoursPreference
}

export interface ReminderControlPayload {
  kind: ReminderKind
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  water: {
    enabled: true,
    intervalMinutes: 60,
    showOsNotification: true
  },
  stretch: {
    enabled: true,
    intervalMinutes: 90,
    showOsNotification: true
  },
  quietHours: {
    enabled: true,
    startHour: 23,
    endHour: 7
  }
}
