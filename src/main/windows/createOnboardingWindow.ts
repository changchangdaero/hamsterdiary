import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import { getWindowIconPath } from '../paths'
import { configureWindowTaskbar } from './configureWindowTaskbar'

export const createOnboardingWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    icon: getWindowIconPath(),
    width: 720,
    height: 720,
    minWidth: 620,
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
    url.searchParams.set('window', 'onboarding')
    void window.loadURL(url.toString())
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { window: 'onboarding' }
    })
  }
  return window
}
