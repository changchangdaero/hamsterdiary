// 다른 창에서 설정 창을 특정 탭으로 여는 요청을 처리하는 IPC입니다.
import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import type { SettingsSection } from '../../shared/types/foundation'

interface Options {
  getTrustedWindows: () => Array<BrowserWindow | null>
  openSettings: (section?: SettingsSection) => void
}

const SECTIONS: SettingsSection[] = ['conversation', 'reminders', 'focus', 'pet']

export const registerSettingsIpc = (options: Options): (() => void) => {
  ipcMain.handle(IPC_CHANNELS.openSettings, (event: IpcMainInvokeEvent, section: unknown) => {
    const trusted = options.getTrustedWindows().some(
      (window) =>
        window !== null && !window.isDestroyed() && event.sender === window.webContents
    )
    if (!trusted) throw new Error('허용되지 않은 설정 요청입니다.')
    if (section !== undefined && !SECTIONS.includes(section as SettingsSection)) {
      throw new Error('알 수 없는 설정 화면입니다.')
    }
    options.openSettings(section as SettingsSection | undefined)
  })
  return () => ipcMain.removeHandler(IPC_CHANNELS.openSettings)
}
