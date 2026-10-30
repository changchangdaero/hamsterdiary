import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'

interface Options {
  getWindow: () => BrowserWindow | null
  complete: () => void
}

export const registerOnboardingIpc = (options: Options): (() => void) => {
  ipcMain.handle(IPC_CHANNELS.completeOnboarding, (event: IpcMainInvokeEvent) => {
    const window = options.getWindow()
    if (!window || window.isDestroyed() || event.sender !== window.webContents) {
      throw new Error('허용되지 않은 온보딩 요청이야.')
    }
    options.complete()
  })
  return () => ipcMain.removeHandler(IPC_CHANNELS.completeOnboarding)
}
