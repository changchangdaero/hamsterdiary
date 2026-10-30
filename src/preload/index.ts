// renderer에 허용된 최소 foundation 및 펫 제어 API를 노출하는 preload 파일입니다.
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipcChannels'
import type { DesktopPetAPI } from '../shared/types/foundation'
import type {
  PetActionRequest,
  PetBehaviorSettings,
  PetEmotion,
  PetScheduleInputPlacement,
  ResolvedPetMessage
} from '../shared/types/pet'
import type { PomodoroState } from '../shared/types/pomodoro'
import type { Todo } from '../shared/types/todo'
import type { NotebookViewRequest } from '../shared/types/notebook'

const subscribe = <T>(
  channel: string,
  listener: (payload: T) => void
): (() => void) => {
  const wrappedListener = (_event: Electron.IpcRendererEvent, payload: T): void =>
    listener(payload)
  ipcRenderer.on(channel, wrappedListener)
  return () => ipcRenderer.removeListener(channel, wrappedListener)
}

const subscribeWithoutPayload = (
  channel: string,
  listener: () => void
): (() => void) => {
  const wrappedListener = (): void => listener()
  ipcRenderer.on(channel, wrappedListener)
  return () => ipcRenderer.removeListener(channel, wrappedListener)
}

const desktopPetAPI: DesktopPetAPI = {
  getFoundationStatus: () => ipcRenderer.invoke(IPC_CHANNELS.getFoundationStatus),
  incrementPhase0Counter: () =>
    ipcRenderer.invoke(IPC_CHANNELS.incrementPhase0Counter),
  setPetMouseInteractive: (interactive) =>
    ipcRenderer.send(IPC_CHANNELS.setPetMouseInteractive, interactive),
  beginPetDrag: (payload) =>
    ipcRenderer.send(IPC_CHANNELS.beginPetDrag, payload),
  movePetDrag: (payload) =>
    ipcRenderer.send(IPC_CHANNELS.movePetDrag, payload),
  endPetDrag: () => ipcRenderer.send(IPC_CHANNELS.endPetDrag),
  setPetEmotion: (emotion) =>
    ipcRenderer.invoke(IPC_CHANNELS.setPetEmotion, emotion),
  showPetMessage: (payload) =>
    ipcRenderer.invoke(IPC_CHANNELS.showPetMessage, payload),
  hidePetMessage: () => ipcRenderer.invoke(IPC_CHANNELS.hidePetMessage),
  showPetContextMenu: () =>
    ipcRenderer.send(IPC_CHANNELS.showPetContextMenu),
  openPetScheduleInput: () =>
    ipcRenderer.send(IPC_CHANNELS.openPetScheduleInput),
  closePetScheduleInput: () =>
    ipcRenderer.send(IPC_CHANNELS.closePetScheduleInput),
  notifyPetRendererReady: () =>
    ipcRenderer.send(IPC_CHANNELS.petRendererReady),
  onPetScheduleInputOpened: (listener) =>
    subscribe<PetScheduleInputPlacement>(
      IPC_CHANNELS.petScheduleInputOpened,
      listener
    ),
  onPetScheduleInputClosed: (listener) =>
    subscribeWithoutPayload(IPC_CHANNELS.petScheduleInputClosed, listener),
  onPetEmotionChanged: (listener) =>
    subscribe<PetEmotion>(IPC_CHANNELS.petEmotionChanged, listener),
  onPetMessageShown: (listener) =>
    subscribe<ResolvedPetMessage>(IPC_CHANNELS.petMessageShown, listener),
  onPetMessageHidden: (listener) =>
    subscribeWithoutPayload(IPC_CHANNELS.petMessageHidden, listener),
  onPetWindowHidden: (listener) =>
    subscribeWithoutPayload(IPC_CHANNELS.petWindowHidden, listener),
  onPetUserPresenceChanged: (listener) =>
    subscribe<boolean>(IPC_CHANNELS.petUserPresenceChanged, listener),
  getPetBehaviorSettings: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getPetBehaviorSettings),
  updatePetBehaviorSettings: (settings) =>
    ipcRenderer.invoke(IPC_CHANNELS.updatePetBehaviorSettings, settings),
  onPetBehaviorSettingsChanged: (listener) =>
    subscribe<PetBehaviorSettings>(IPC_CHANNELS.petBehaviorSettingsChanged, listener),
  playPetAction: (actionId) =>
    ipcRenderer.invoke(IPC_CHANNELS.playPetAction, actionId),
  onPetActionRequested: (listener) =>
    subscribe<PetActionRequest>(IPC_CHANNELS.petActionRequested, listener),
  reportPetActionResult: (result) =>
    ipcRenderer.send(IPC_CHANNELS.petActionResult, result),
  converseWithHami: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.converseWithHami, request),
  getHamiUsage: () => ipcRenderer.invoke(IPC_CHANNELS.getHamiUsage),
  listSchedules: () => ipcRenderer.invoke(IPC_CHANNELS.listSchedules),
  createSchedule: (draft) =>
    ipcRenderer.invoke(IPC_CHANNELS.createSchedule, draft),
  updateSchedule: (payload) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateSchedule, payload),
  deleteSchedule: (id) =>
    ipcRenderer.invoke(IPC_CHANNELS.deleteSchedule, id),
  setScheduleCompleted: (payload) =>
    ipcRenderer.invoke(IPC_CHANNELS.setScheduleCompleted, payload),
  openScheduleDiary: () =>
    ipcRenderer.invoke(IPC_CHANNELS.openScheduleDiary),
  openNewSchedule: (date) =>
    ipcRenderer.invoke(IPC_CHANNELS.openNewSchedule, date),
  notifyScheduleDiaryReady: () =>
    ipcRenderer.send(IPC_CHANNELS.scheduleDiaryReady),
  onScheduleOpenNewRequested: (listener) =>
    subscribe<string | undefined>(
      IPC_CHANNELS.scheduleOpenNewRequested,
      listener
    ),
  onSchedulesChanged: (listener) =>
    subscribe(IPC_CHANNELS.schedulesChanged, listener),
  listHolidays: (years) =>
    ipcRenderer.invoke(IPC_CHANNELS.listHolidays, years),
  completeOnboarding: () =>
    ipcRenderer.invoke(IPC_CHANNELS.completeOnboarding),
  openSettings: (section) => ipcRenderer.invoke(IPC_CHANNELS.openSettings, section),
  onSettingsSectionRequested: (listener) =>
    subscribe(IPC_CHANNELS.settingsSectionRequested, listener),
  setSettingsDirty: (dirty) =>
    ipcRenderer.send(IPC_CHANNELS.settingsDirtyChanged, dirty),
  openHelp: () => ipcRenderer.invoke(IPC_CHANNELS.openHelp),
  closeHelp: () => ipcRenderer.invoke(IPC_CHANNELS.closeHelp),
  getPomodoroState: () => ipcRenderer.invoke(IPC_CHANNELS.getPomodoroState),
  startPomodoro: () => ipcRenderer.invoke(IPC_CHANNELS.startPomodoro),
  pausePomodoro: () => ipcRenderer.invoke(IPC_CHANNELS.pausePomodoro),
  resetPomodoro: () => ipcRenderer.invoke(IPC_CHANNELS.resetPomodoro),
  getPomodoroSettings: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getPomodoroSettings),
  updatePomodoroSettings: (settings) =>
    ipcRenderer.invoke(IPC_CHANNELS.updatePomodoroSettings, settings),
  openPomodoro: () => ipcRenderer.invoke(IPC_CHANNELS.openPomodoro),
  closePomodoro: () => ipcRenderer.invoke(IPC_CHANNELS.closePomodoro),
  onPomodoroChanged: (listener) =>
    subscribe<PomodoroState>(IPC_CHANNELS.pomodoroChanged, listener),
  listTodos: () => ipcRenderer.invoke(IPC_CHANNELS.listTodos),
  createTodo: (text) => ipcRenderer.invoke(IPC_CHANNELS.createTodo, text),
  setTodoDone: (payload) =>
    ipcRenderer.invoke(IPC_CHANNELS.setTodoDone, payload),
  deleteTodo: (id) => ipcRenderer.invoke(IPC_CHANNELS.deleteTodo, id),
  openTodos: () => ipcRenderer.invoke(IPC_CHANNELS.openTodos),
  onTodosChanged: (listener) =>
    subscribe<Todo[]>(IPC_CHANNELS.todosChanged, listener),
  getDiary: (date) => ipcRenderer.invoke(IPC_CHANNELS.getDiary, date),
  listDiaryDates: () => ipcRenderer.invoke(IPC_CHANNELS.listDiaryDates),
  saveDiary: (payload) => ipcRenderer.invoke(IPC_CHANNELS.saveDiary, payload),
  openDiary: (date) => ipcRenderer.invoke(IPC_CHANNELS.openDiary, date),
  onDiaryChanged: (listener) =>
    subscribe<string[]>(IPC_CHANNELS.diaryChanged, listener),
  getDailyPlan: (date) => ipcRenderer.invoke(IPC_CHANNELS.getDailyPlan, date),
  listDailyPlanDates: () =>
    ipcRenderer.invoke(IPC_CHANNELS.listDailyPlanDates),
  saveDailyPlan: (payload) =>
    ipcRenderer.invoke(IPC_CHANNELS.saveDailyPlan, payload),
  openDailyPlan: (date) => ipcRenderer.invoke(IPC_CHANNELS.openDailyPlan, date),
  commentOnDailyPlan: (date) =>
    ipcRenderer.invoke(IPC_CHANNELS.commentOnDailyPlan, date),
  onDailyPlanChanged: (listener) =>
    subscribe<string[]>(IPC_CHANNELS.dailyPlanChanged, listener),
  closeNotebook: () => ipcRenderer.invoke(IPC_CHANNELS.closeNotebook),
  onNotebookViewRequested: (listener) =>
    subscribe<NotebookViewRequest>(IPC_CHANNELS.notebookViewRequested, listener),
  getReminderSettings: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getReminderSettings),
  updateReminderSettings: (settings) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateReminderSettings, settings),
  snoozeReminder: (payload) =>
    ipcRenderer.invoke(IPC_CHANNELS.snoozeReminder, payload),
  muteReminderForToday: (payload) =>
    ipcRenderer.invoke(IPC_CHANNELS.muteReminderForToday, payload)
}

contextBridge.exposeInMainWorld('desktopPetAPI', desktopPetAPI)
