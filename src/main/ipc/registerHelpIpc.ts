import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'

interface Options {
  getTrustedWindows: () => Array<BrowserWindow | null>
  openHelp: () => void
  closeHelp: () => void
}

export const registerHelpIpc = (options: Options): (() => void) => {
  const assertTrusted = (event: IpcMainInvokeEvent): void => {
    const trusted = options.getTrustedWindows().some(
      (window) =>
        window !== null && !window.isDestroyed() && event.sender === window.webContents
    )
    if (!trusted) throw new Error('허용되지 않은 도움말 요청입니다.')
  }
  ipcMain.handle(IPC_CHANNELS.openHelp, (event) => {
    assertTrusted(event)
    options.openHelp()
  })
  ipcMain.handle(IPC_CHANNELS.closeHelp, (event) => {
    assertTrusted(event)
    options.closeHelp()
  })
  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.openHelp)
    ipcMain.removeHandler(IPC_CHANNELS.closeHelp)
  }
}
