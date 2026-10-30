import { ipcMain, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'

interface Options {
  getNotebookWindow: () => BrowserWindow | null
  closeNotebook: () => void
}

export const registerNotebookIpc = (options: Options): (() => void) => {
  ipcMain.handle(IPC_CHANNELS.closeNotebook, (event) => {
    const notebookWindow = options.getNotebookWindow()
    if (
      !notebookWindow ||
      notebookWindow.isDestroyed() ||
      event.sender !== notebookWindow.webContents
    ) {
      throw new Error('허용되지 않은 노트 창 요청입니다.')
    }
    options.closeNotebook()
  })
  return () => ipcMain.removeHandler(IPC_CHANNELS.closeNotebook)
}
