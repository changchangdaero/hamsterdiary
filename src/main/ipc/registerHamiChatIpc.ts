import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import type { HamiChatRequest } from '../../shared/types/chat'
import { converseWithHami, getHamiUsage } from '../services/hamiChatService'

interface Options {
  getPetWindow: () => BrowserWindow | null
  // Windows that may read the remaining-chat counters (pet chat box and settings).
  getUsageWindows: () => Array<BrowserWindow | null>
}

const isSender = (window: BrowserWindow | null, event: IpcMainInvokeEvent): boolean =>
  window !== null && !window.isDestroyed() && event.sender === window.webContents

export const registerHamiChatIpc = (options: Options): (() => void) => {
  ipcMain.handle(
    IPC_CHANNELS.converseWithHami,
    (event: IpcMainInvokeEvent, request: HamiChatRequest) => {
      if (!isSender(options.getPetWindow(), event)) {
        throw new Error('허용되지 않은 AI 대화 요청이야.')
      }
      return converseWithHami(request)
    }
  )
  ipcMain.handle(IPC_CHANNELS.getHamiUsage, (event: IpcMainInvokeEvent) => {
    if (!options.getUsageWindows().some((window) => isSender(window, event))) {
      throw new Error('허용되지 않은 사용량 요청이야.')
    }
    return getHamiUsage()
  })
  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.converseWithHami)
    ipcMain.removeHandler(IPC_CHANNELS.getHamiUsage)
  }
}
