// 세 electron-store 파일에 저장되는 데이터 구조를 정의하는 파일입니다.
import type { Schedule } from './schedule'
import type { ReminderSettings } from './notifications'
import type { Holiday } from './holiday'
export interface PetPosition {
  x: number
  y: number
}

export interface SettingsStoreData {
  dataVersion: number
  petEnabled: boolean
  alwaysOnTop: boolean
  reminders: ReminderSettings
}

export interface SchedulesStoreData {
  dataVersion: number
  schedules: Schedule[]
}

export interface RuntimeStoreData {
  dataVersion: number
  phase0Counter: number
  petPosition: PetPosition | null
  petWindowLayoutVersion: number
}

export interface HolidayYearCache {
  fetchedAt: string
  items: Holiday[]
}

export interface HolidaysStoreData {
  dataVersion: number
  years: Record<string, HolidayYearCache>
}

export interface CredentialsStoreData {
  dataVersion: number
  geminiApiKey: string | null
}
