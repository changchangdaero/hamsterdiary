// 구간 0에서 main, preload, renderer가 주고받는 데이터 타입을 정의하는 파일입니다.
import type {
  RuntimeStoreData,
  SchedulesStoreData,
  SettingsStoreData
} from './stores'
import type {
  PetEmotion,
  PetDragMovePayload,
  PetMessagePayload,
  PetScheduleInputPlacement,
  ResolvedPetMessage
} from './pet'
import type {
  Schedule,
  ScheduleDraft,
  SetScheduleCompletedPayload,
  UpdateSchedulePayload
} from './schedule'
import type {
  ReminderControlPayload,
  ReminderSettings
} from './notifications'
import type {
  ScheduleConversationRequest,
  ScheduleConversationResponse
} from './scheduleConversation'
import type { Holiday } from './holiday'
import type { GeminiKeyStatus } from './geminiKey'
import type { PomodoroSettings, PomodoroState } from './pomodoro'
import type {
  SetTodoDonePayload,
  Todo,
  TodoConversationRequest,
  TodoConversationResponse
} from './todo'

export interface RuntimeVersions {
  electron: string
  chrome: string
  node: string
}

export interface FoundationStatus {
  versions: RuntimeVersions
  stores: {
    settings: SettingsStoreData
    schedules: SchedulesStoreData
    runtime: RuntimeStoreData
  }
}

export interface DesktopPetAPI {
  getFoundationStatus: () => Promise<FoundationStatus>
  incrementPhase0Counter: () => Promise<FoundationStatus>
  setPetMouseInteractive: (interactive: boolean) => void
  beginPetDrag: (payload: PetDragMovePayload) => void
  movePetDrag: (payload: PetDragMovePayload) => void
  endPetDrag: () => void
  setPetEmotion: (emotion: PetEmotion) => Promise<void>
  showPetMessage: (payload: PetMessagePayload) => Promise<void>
  hidePetMessage: () => Promise<void>
  showPetContextMenu: () => void
  closePetScheduleInput: () => void
  onPetScheduleInputOpened: (
    listener: (placement: PetScheduleInputPlacement) => void
  ) => () => void
  onPetScheduleInputClosed: (listener: () => void) => () => void
  onPetEmotionChanged: (listener: (emotion: PetEmotion) => void) => () => void
  onPetMessageShown: (
    listener: (message: ResolvedPetMessage) => void
  ) => () => void
  onPetMessageHidden: (listener: () => void) => () => void
  onPetWindowHidden: (listener: () => void) => () => void
  converseAboutSchedule: (
    request: ScheduleConversationRequest
  ) => Promise<ScheduleConversationResponse>
  listSchedules: () => Promise<Schedule[]>
  createSchedule: (draft: ScheduleDraft) => Promise<Schedule[]>
  updateSchedule: (payload: UpdateSchedulePayload) => Promise<Schedule[]>
  deleteSchedule: (id: string) => Promise<Schedule[]>
  setScheduleCompleted: (
    payload: SetScheduleCompletedPayload
  ) => Promise<Schedule[]>
  openScheduleDiary: () => Promise<void>
  openNewSchedule: (date?: string) => Promise<void>
  notifyScheduleDiaryReady: () => void
  onScheduleOpenNewRequested: (
    listener: (date?: string) => void
  ) => () => void
  onSchedulesChanged: (listener: (schedules: Schedule[]) => void) => () => void
  listHolidays: (years: number[]) => Promise<Holiday[]>
  getGeminiKeyStatus: () => Promise<GeminiKeyStatus>
  saveGeminiKey: (key: string) => Promise<GeminiKeyStatus>
  deleteGeminiKey: () => Promise<GeminiKeyStatus>
  openGeminiKeyPage: () => Promise<void>
  completeOnboarding: () => Promise<void>
  openSettings: () => Promise<void>
  openHelp: () => Promise<void>
  closeHelp: () => Promise<void>
  getPomodoroState: () => Promise<PomodoroState>
  startPomodoro: () => Promise<PomodoroState>
  pausePomodoro: () => Promise<PomodoroState>
  resetPomodoro: () => Promise<PomodoroState>
  getPomodoroSettings: () => Promise<PomodoroSettings>
  updatePomodoroSettings: (
    settings: PomodoroSettings
  ) => Promise<PomodoroSettings>
  openPomodoro: () => Promise<void>
  closePomodoro: () => Promise<void>
  onPomodoroChanged: (
    listener: (state: PomodoroState) => void
  ) => () => void
  listTodos: () => Promise<Todo[]>
  createTodo: (text: string) => Promise<Todo[]>
  setTodoDone: (payload: SetTodoDonePayload) => Promise<Todo[]>
  deleteTodo: (id: string) => Promise<Todo[]>
  converseAboutTodo: (
    request: TodoConversationRequest
  ) => Promise<TodoConversationResponse>
  openTodos: () => Promise<void>
  closeTodos: () => Promise<void>
  onTodosChanged: (listener: (todos: Todo[]) => void) => () => void
  getReminderSettings: () => Promise<ReminderSettings>
  updateReminderSettings: (
    settings: ReminderSettings
  ) => Promise<ReminderSettings>
  snoozeReminder: (payload: ReminderControlPayload) => Promise<void>
  muteReminderForToday: (payload: ReminderControlPayload) => Promise<void>
}
