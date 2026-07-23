// renderer에 허용된 최소 foundation 및 펫 제어 API를 노출하는 preload 파일입니다.
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipcChannels'
import type { DesktopPetAPI } from '../shared/types/foundation'

const desktopPetAPI: DesktopPetAPI = {
  getFoundationStatus: () => ipcRenderer.invoke(IPC_CHANNELS.getFoundationStatus),
  incrementPhase0Counter: () =>
    ipcRenderer.invoke(IPC_CHANNELS.incrementPhase0Counter),
  setPetMouseInteractive: (interactive) =>
    ipcRenderer.send(IPC_CHANNELS.setPetMouseInteractive, interactive),
  beginPetDrag: (screenX, screenY) =>
    ipcRenderer.send(IPC_CHANNELS.beginPetDrag, screenX, screenY),
  movePetDrag: (screenX, screenY) =>
    ipcRenderer.send(IPC_CHANNELS.movePetDrag, screenX, screenY),
  endPetDrag: () => ipcRenderer.send(IPC_CHANNELS.endPetDrag)
}

contextBridge.exposeInMainWorld('desktopPetAPI', desktopPetAPI)
