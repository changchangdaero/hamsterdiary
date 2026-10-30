import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import type { HamiChatRequest } from '../../shared/types/chat'
import { converseWithHami } from '../services/hamiChatService'

interface Options {
  getPetWindow: () => BrowserWindow | null
}

export const registerHamiChatIpc = (options: Options): (() => void) => {
  ipcMain.handle(
    IPC_CHANNELS.converseWithHami,
    (event: IpcMainInvokeEvent, request: HamiChatRequest) => {
      const petWindow = options.getPetWindow()
      if (!petWindow || petWindow.isDestroyed() || event.sender !== petWindow.webContents) {
        throw new Error('허용되지 않은 AI 대화 요청이야.')
      }
      return converseWithHami(request)
    }
  )
  return () => ipcMain.removeHandler(IPC_CHANNELS.converseWithHami)
}
