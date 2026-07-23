// 앱 수명 주기, 단일 인스턴스 잠금, 창과 IPC 초기화를 담당하는 main 진입 파일입니다.
import { app, BrowserWindow } from 'electron'
import { registerFoundationIpc } from './ipc/registerFoundationIpc'
import { createMainWindow } from './windows/createMainWindow'

let mainWindow: BrowserWindow | null = null
const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.show()
    mainWindow.focus()
  })

  void app.whenReady().then(() => {
    registerFoundationIpc()
    mainWindow = createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
