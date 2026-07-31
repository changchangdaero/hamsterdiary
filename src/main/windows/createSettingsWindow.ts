// 반복 리마인더와 야간 무음 옵션을 편집하는 설정 창을 생성하는 파일입니다.
import { join } from 'node:path'
import { BrowserWindow } from 'electron'

export const createSettingsWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
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
  window.once('ready-to-show', () => window.show())
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    url.searchParams.set('window', 'settings')
    void window.loadURL(url.toString())
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { window: 'settings' }
    })
  }
  return window
}
