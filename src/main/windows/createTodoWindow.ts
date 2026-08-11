import { join } from 'node:path'
import { BrowserWindow } from 'electron'

export const createTodoWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    width: 700,
    height: 720,
    minWidth: 560,
    minHeight: 560,
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
    url.searchParams.set('window', 'todos')
    void window.loadURL(url.toString())
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { window: 'todos' }
    })
  }
  return window
}
