import { BrowserWindow, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import {
  deleteGeminiApiKey,
  getGeminiKeyStatus,
  saveGeminiApiKey
} from '../services/geminiKeyService'

interface Options {
  getTrustedWindows: () => Array<BrowserWindow | null>
  completeOnboarding: () => void
  openSettings: () => void
}

export const registerGeminiKeyIpc = (options: Options): (() => void) => {
  const assertTrusted = (event: IpcMainInvokeEvent): void => {
    const trusted = options.getTrustedWindows().some(
      (window) =>
        window !== null && !window.isDestroyed() && event.sender === window.webContents
    )
    if (!trusted) throw new Error('허용되지 않은 API 키 요청입니다.')
  }

  ipcMain.handle(IPC_CHANNELS.getGeminiKeyStatus, (event) => {
    assertTrusted(event)
    return getGeminiKeyStatus()
  })
  ipcMain.handle(IPC_CHANNELS.saveGeminiKey, (event, key: unknown) => {
    assertTrusted(event)
    return saveGeminiApiKey(key)
  })
  ipcMain.handle(IPC_CHANNELS.deleteGeminiKey, (event) => {
    assertTrusted(event)
    return deleteGeminiApiKey()
  })
  ipcMain.handle(IPC_CHANNELS.openGeminiKeyPage, async (event) => {
    assertTrusted(event)
    await shell.openExternal('https://aistudio.google.com/apikey')
  })
  ipcMain.handle(IPC_CHANNELS.completeOnboarding, (event) => {
    assertTrusted(event)
    options.completeOnboarding()
  })
  ipcMain.handle(IPC_CHANNELS.openSettings, (event) => {
    assertTrusted(event)
    options.openSettings()
  })

  return () => {
    for (const channel of [
      IPC_CHANNELS.getGeminiKeyStatus,
      IPC_CHANNELS.saveGeminiKey,
      IPC_CHANNELS.deleteGeminiKey,
      IPC_CHANNELS.openGeminiKeyPage,
      IPC_CHANNELS.completeOnboarding,
      IPC_CHANNELS.openSettings
    ]) {
      ipcMain.removeHandler(channel)
    }
  }
}

