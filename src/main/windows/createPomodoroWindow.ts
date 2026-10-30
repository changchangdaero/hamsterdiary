import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import { getWindowIconPath } from '../paths'
import { configureWindowTaskbar } from './configureWindowTaskbar'

export const createPomodoroWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    icon: getWindowIconPath(),
    width: 520,
    height: 680,
    minWidth: 460,
    minHeight: 640,
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
  window.once('ready-to-show', () => window.show())
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    url.searchParams.set('window', 'pomodoro')
    void window.loadURL(url.toString())
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { window: 'pomodoro' }
    })
  }
  return window
}
