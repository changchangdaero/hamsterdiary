import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import type { NotebookViewRequest } from '../../shared/types/notebook'
import { getWindowIconPath } from '../paths'
import { configureWindowTaskbar } from './configureWindowTaskbar'

// One window hosts the todo, diary and daily plan tabs and switches between them in place.
export const createNotebookWindow = (request: NotebookViewRequest): BrowserWindow => {
  const window = new BrowserWindow({
    icon: getWindowIconPath(),
    width: 1100,
    height: 860,
    minWidth: 860,
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
  const query: Record<string, string> = { window: 'notebook', view: request.view }
  if (request.date) query.date = request.date
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
    void window.loadURL(url.toString())
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }
  return window
}
