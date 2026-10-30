// 세 electron-store 파일에 저장되는 데이터 구조를 정의하는 파일입니다.
import type { Schedule } from './schedule'
import type { ReminderSettings } from './notifications'
import type { Holiday } from './holiday'
import type {
  PomodoroSettings,
  StoredPomodoroState
} from './pomodoro'
import type { Todo } from './todo'
import type { PetBehaviorSettings } from './pet'
export interface PetPosition {
  x: number
  y: number
}

export interface SettingsStoreData {
  dataVersion: number
  petEnabled: boolean
  alwaysOnTop: boolean
  onboardingWelcomeShown: boolean
  reminders: ReminderSettings
  pomodoro: PomodoroSettings
  petBehavior: PetBehaviorSettings
}

export interface SchedulesStoreData {
  dataVersion: number
  schedules: Schedule[]
}

export interface RuntimeStoreData {
  dataVersion: number
  installationId: string | null
  phase0Counter: number
  petPosition: PetPosition | null
  petWindowLayoutVersion: number
  pomodoro: StoredPomodoroState
}

export interface HolidayYearCache {
  fetchedAt: string
  items: Holiday[]
}

export interface HolidaysStoreData {
  dataVersion: number
  years: Record<string, HolidayYearCache>
}

export interface TodosStoreData {
  dataVersion: number
  todos: Todo[]
}
