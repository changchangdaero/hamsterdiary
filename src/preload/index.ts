// renderer에 허용된 최소 foundation 및 펫 제어 API를 노출하는 preload 파일입니다.
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipcChannels'
import type { DesktopPetAPI } from '../shared/types/foundation'
import type {
  PetEmotion,
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
  onPetEmotionChanged: (listener) =>
    subscribe<PetEmotion>(IPC_CHANNELS.petEmotionChanged, listener),
  onPetMessageShown: (listener) =>
    subscribe<ResolvedPetMessage>(IPC_CHANNELS.petMessageShown, listener),
  onPetMessageHidden: (listener) =>
    subscribeWithoutPayload(IPC_CHANNELS.petMessageHidden, listener),
  onPetWindowHidden: (listener) =>
    subscribeWithoutPayload(IPC_CHANNELS.petWindowHidden, listener)
}

contextBridge.exposeInMainWorld('desktopPetAPI', desktopPetAPI)
