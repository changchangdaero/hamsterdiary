export const DEFAULT_POMODORO_SETTINGS = {
  focusMinutes: 25,
  breakMinutes: 5
} as const

export interface PomodoroSettings {
  focusMinutes: number
  breakMinutes: number
}

export type PomodoroMode = 'focus' | 'break'
export type PomodoroRunState = 'idle' | 'running' | 'paused'

export interface PomodoroState {
  mode: PomodoroMode
  runState: PomodoroRunState
  remainingSeconds: number
  durationSeconds: number
  endAt: string | null
}

export interface StoredPomodoroState {
  mode: PomodoroMode
  runState: PomodoroRunState
  remainingSeconds: number
  endAt: string | null
}

export type PomodoroEvent = 'focus-started' | 'focus-completed' | 'break-completed'

