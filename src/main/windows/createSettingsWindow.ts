// 반복 리마인더와 야간 무음 옵션을 편집하는 설정 창을 생성하는 파일입니다.
import { join } from 'node:path'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import type { SettingsSection } from '../../shared/types/foundation'
import { getWindowIconPath } from '../paths'
import { configureWindowTaskbar } from './configureWindowTaskbar'

export const createSettingsWindow = (
  initialSection: SettingsSection = 'conversation'
): BrowserWindow => {
  let hasUnsavedChanges = false
  let allowClose = false
  const window = new BrowserWindow({
    icon: getWindowIconPath(),
    width: 620,
    height: 700,
    minWidth: 520,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  configureWindowTaskbar(window)
  const updateDirtyState = (
    event: Electron.IpcMainEvent,
    dirty: unknown
  ): void => {
    if (event.sender === window.webContents && typeof dirty === 'boolean') {
      hasUnsavedChanges = dirty
    }
  }
  ipcMain.on(IPC_CHANNELS.settingsDirtyChanged, updateDirtyState)
  window.on('close', (event) => {
    if (!hasUnsavedChanges || allowClose) return
    event.preventDefault()
    const choice = dialog.showMessageBoxSync(window, {
      type: 'warning',
      title: '저장하지 않은 변경사항',
      message: '저장하지 않은 변경사항이 있어. 그대로 닫을까?',
      buttons: ['계속 설정하기', '변경사항 버리기'],
      defaultId: 0,
      cancelId: 0
    })
    if (choice === 1) {
      allowClose = true
      window.close()
    }
  })
  window.once('closed', () => {
    ipcMain.removeListener(IPC_CHANNELS.settingsDirtyChanged, updateDirtyState)
  })
  window.once('ready-to-show', () => window.show())
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    url.searchParams.set('window', 'settings')
    url.searchParams.set('section', initialSection)
    void window.loadURL(url.toString())
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { window: 'settings', section: initialSection }
    })
  }
  return window
}
