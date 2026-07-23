// renderer에 허용된 구간 0 API 두 개만 contextBridge로 노출하는 preload 파일입니다.
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipcChannels'
import type { DesktopPetAPI } from '../shared/types/foundation'

const desktopPetAPI: DesktopPetAPI = {
  getFoundationStatus: () => ipcRenderer.invoke(IPC_CHANNELS.getFoundationStatus),
  incrementPhase0Counter: () =>
    ipcRenderer.invoke(IPC_CHANNELS.incrementPhase0Counter)
}

contextBridge.exposeInMainWorld('desktopPetAPI', desktopPetAPI)
