// renderer에 허용된 최소 foundation 및 펫 제어 API를 노출하는 preload 파일입니다.
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipcChannels'
import type { DesktopPetAPI } from '../shared/types/foundation'
import type {
  PetEmotion,
  PetScheduleInputPlacement,
  ResolvedPetMessage
} from '../shared/types/pet'

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
  closePetScheduleInput: () =>
    ipcRenderer.send(IPC_CHANNELS.closePetScheduleInput),
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
  converseAboutSchedule: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.converseAboutSchedule, request),
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
  getGeminiKeyStatus: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getGeminiKeyStatus),
  saveGeminiKey: (key) =>
    ipcRenderer.invoke(IPC_CHANNELS.saveGeminiKey, key),
  deleteGeminiKey: () =>
    ipcRenderer.invoke(IPC_CHANNELS.deleteGeminiKey),
  openGeminiKeyPage: () =>
    ipcRenderer.invoke(IPC_CHANNELS.openGeminiKeyPage),
  completeOnboarding: () =>
    ipcRenderer.invoke(IPC_CHANNELS.completeOnboarding),
  openSettings: () => ipcRenderer.invoke(IPC_CHANNELS.openSettings),
  openHelp: () => ipcRenderer.invoke(IPC_CHANNELS.openHelp),
  closeHelp: () => ipcRenderer.invoke(IPC_CHANNELS.closeHelp),
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
