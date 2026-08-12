import { join } from 'node:path'
import { BrowserWindow } from 'electron'

export const createDiaryWindow = (date?: string): BrowserWindow => {
  const window = new BrowserWindow({
    width: 760,
    height: 760,
    minWidth: 580,
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
  window.once('ready-to-show', () => window.show())
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    url.searchParams.set('window', 'diary')
    if (date) url.searchParams.set('date', date)
    void window.loadURL(url.toString())
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { window: 'diary', ...(date ? { date } : {}) }
    })
  }
  return window
}
