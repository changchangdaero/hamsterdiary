// 구간 0에서 main, preload, renderer가 주고받는 데이터 타입을 정의하는 파일입니다.
import type {
  RuntimeStoreData,
  SchedulesStoreData,
  SettingsStoreData
} from './stores'
import type {
  PetActionPlayStatus,
  PetActionRequest,
  PetActionResult,
  PetBehaviorSettings,
  PetEmotion,
  PetDragMovePayload,
  PetIdleActionId,
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
import type { Holiday } from './holiday'
import type { HamiChatRequest, HamiChatResponse } from './chat'
import type { PomodoroSettings, PomodoroState } from './pomodoro'
import type {
  SetTodoDonePayload,
  Todo
} from './todo'
import type { DiaryEntry, SaveDiaryPayload } from './diary'
import type {
  DailyPlan,
  DailyPlanCommentResult,
  SaveDailyPlanPayload
} from './plan'
import type { NotebookViewRequest } from './notebook'

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

export type SettingsSection = 'conversation' | 'reminders' | 'focus' | 'pet'

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
  openPetScheduleInput: () => void
  closePetScheduleInput: () => void
  notifyPetRendererReady: () => void
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
  onPetUserPresenceChanged: (listener: (away: boolean) => void) => () => void
  getPetBehaviorSettings: () => Promise<PetBehaviorSettings>
  updatePetBehaviorSettings: (
    settings: PetBehaviorSettings
  ) => Promise<PetBehaviorSettings>
  onPetBehaviorSettingsChanged: (
    listener: (settings: PetBehaviorSettings) => void
  ) => () => void
  playPetAction: (actionId: PetIdleActionId) => Promise<PetActionPlayStatus>
  onPetActionRequested: (listener: (request: PetActionRequest) => void) => () => void
  reportPetActionResult: (result: PetActionResult) => void
  converseWithHami: (request: HamiChatRequest) => Promise<HamiChatResponse>
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
  completeOnboarding: () => Promise<void>
  openSettings: (section?: SettingsSection) => Promise<void>
  onSettingsSectionRequested: (
    listener: (section: SettingsSection) => void
  ) => () => void
  setSettingsDirty: (dirty: boolean) => void
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
  openTodos: () => Promise<void>
  onTodosChanged: (listener: (todos: Todo[]) => void) => () => void
  getDiary: (date: string) => Promise<DiaryEntry | null>
  listDiaryDates: () => Promise<string[]>
  saveDiary: (payload: SaveDiaryPayload) => Promise<DiaryEntry | null>
  openDiary: (date?: string) => Promise<void>
  onDiaryChanged: (listener: (dates: string[]) => void) => () => void
  getDailyPlan: (date: string) => Promise<DailyPlan | null>
  listDailyPlanDates: () => Promise<string[]>
  saveDailyPlan: (payload: SaveDailyPlanPayload) => Promise<DailyPlan | null>
  openDailyPlan: (date?: string) => Promise<void>
  commentOnDailyPlan: (date: string) => Promise<DailyPlanCommentResult>
  onDailyPlanChanged: (listener: (dates: string[]) => void) => () => void
  closeNotebook: () => Promise<void>
  onNotebookViewRequested: (
    listener: (request: NotebookViewRequest) => void
  ) => () => void
  getReminderSettings: () => Promise<ReminderSettings>
  updateReminderSettings: (
    settings: ReminderSettings
  ) => Promise<ReminderSettings>
  snoozeReminder: (payload: ReminderControlPayload) => Promise<void>
  muteReminderForToday: (payload: ReminderControlPayload) => Promise<void>
}
