// 설정 화면에서 대화 방식(햄이 서버 / 내 API 키)을 바꾸고, 내 키를 저장·확인·삭제하는 IPC입니다.
import { ipcMain, shell, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import {
  BYOK_PROVIDER_INFO,
  type ByokTestResult,
  type ChatSettings
} from '../../shared/types/byok'
import { ByokError, requestByokReply } from '../services/byokChatService'
import {
  deleteByokKey,
  isByokProvider,
  parseApiKey,
  readByokKey,
  readByokStatus,
  readChatSettings,
  saveByokKey,
  writeChatSettings
} from '../services/byokKeyService'

interface Options {
  getSettingsWindow: () => BrowserWindow | null
}

const TEST_MESSAGE = '안녕! 연결 확인이야. 짧게 인사해줘.'

const parseProvider = (value: unknown) => {
  if (!isByokProvider(value)) throw new Error('알 수 없는 AI 제공사야.')
  return value
}

const testConnection = async (payload: unknown): Promise<ByokTestResult> => {
  const raw = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>
  const provider = parseProvider(raw.provider)
  const model = BYOK_PROVIDER_INFO[provider].models.find((candidate) => candidate.id === raw.model)?.id
  if (!model) throw new Error('알 수 없는 모델이야.')
  const apiKey = raw.apiKey === undefined || raw.apiKey === '' ? readByokKey(provider) : parseApiKey(raw.apiKey)
  if (!apiKey) return { ok: false, reason: 'no-key', message: '먼저 API 키를 입력해 줘.' }
  try {
    const reply = await requestByokReply({ provider, model, apiKey, message: TEST_MESSAGE, history: [] })
    return { ok: true, reply }
  } catch (error) {
    if (error instanceof ByokError) {
      const message = error.message.replace(/^\[[A-Z_]+\]\s*/u, '')
      return { ok: false, reason: error.reason, message: error.detail ? `${message} (${error.detail})` : message }
    }
    return { ok: false, reason: 'failed', message: '연결 확인에 실패했어.' }
  }
}

export const registerByokIpc = (options: Options): (() => void) => {
  const assertSettings = (event: IpcMainInvokeEvent): void => {
    const window = options.getSettingsWindow()
    if (!window || window.isDestroyed() || event.sender !== window.webContents) {
      throw new Error('허용되지 않은 AI 설정 요청이야.')
    }
  }

  ipcMain.handle(IPC_CHANNELS.getChatSettings, (event) => {
    assertSettings(event)
    return readChatSettings()
  })
  ipcMain.handle(IPC_CHANNELS.updateChatSettings, (event, settings: ChatSettings) => {
    assertSettings(event)
    return writeChatSettings(settings)
  })
  ipcMain.handle(IPC_CHANNELS.getByokStatus, (event) => {
    assertSettings(event)
    return readByokStatus()
  })
  ipcMain.handle(IPC_CHANNELS.saveByokKey, (event, payload: unknown) => {
    assertSettings(event)
    const raw = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>
    saveByokKey(parseProvider(raw.provider), parseApiKey(raw.apiKey))
    return readByokStatus()
  })
  ipcMain.handle(IPC_CHANNELS.deleteByokKey, (event, provider: unknown) => {
    assertSettings(event)
    deleteByokKey(parseProvider(provider))
    return readByokStatus()
  })
  ipcMain.handle(IPC_CHANNELS.testByok, (event, payload: unknown) => {
    assertSettings(event)
    return testConnection(payload)
  })
  // Opens only the provider pages listed in BYOK_PROVIDER_INFO, never a URL from the screen.
  ipcMain.handle(IPC_CHANNELS.openByokPage, (event, provider: unknown, page: unknown) => {
    assertSettings(event)
    const info = BYOK_PROVIDER_INFO[parseProvider(provider)]
    void shell.openExternal(page === 'usage' ? info.usagePageUrl : info.keyPageUrl)
  })

  return () => {
    for (const channel of [
      IPC_CHANNELS.getChatSettings,
      IPC_CHANNELS.updateChatSettings,
      IPC_CHANNELS.getByokStatus,
      IPC_CHANNELS.saveByokKey,
      IPC_CHANNELS.deleteByokKey,
      IPC_CHANNELS.testByok,
      IPC_CHANNELS.openByokPage
    ]) {
      ipcMain.removeHandler(channel)
    }
  }
}
