// 내 API 키를 OS 암호화로 저장·삭제하고, 대화 방식 설정을 읽고 고치는 서비스입니다.
// 키 원문은 이 메인 프로세스 밖(화면)으로 절대 보내지 않습니다.
import { safeStorage } from 'electron'
import {
  BYOK_PROVIDER_INFO,
  BYOK_PROVIDERS,
  CHAT_MODES,
  DEFAULT_CHAT_SETTINGS,
  type ByokProvider,
  type ByokStatus,
  type ChatSettings
} from '../../shared/types/byok'
import { byokKeysStore, settingsStore } from '../stores'

const MAX_KEY_LENGTH = 400

export const isByokProvider = (value: unknown): value is ByokProvider =>
  BYOK_PROVIDERS.includes(value as ByokProvider)

const isKnownModel = (provider: ByokProvider, model: unknown): model is string =>
  BYOK_PROVIDER_INFO[provider].models.some((candidate) => candidate.id === model)

export const sanitizeChatSettings = (value: unknown): ChatSettings => {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Partial<ChatSettings>
  const provider = isByokProvider(raw.provider) ? raw.provider : DEFAULT_CHAT_SETTINGS.provider
  const models = { ...DEFAULT_CHAT_SETTINGS.models }
  for (const id of BYOK_PROVIDERS) {
    const model = raw.models?.[id]
    if (isKnownModel(id, model)) models[id] = model
  }
  return {
    mode: CHAT_MODES.includes(raw.mode as never) ? (raw.mode as ChatSettings['mode']) : 'server',
    provider,
    models
  }
}

export const readChatSettings = (): ChatSettings => sanitizeChatSettings(settingsStore.get('chat'))

export const writeChatSettings = (value: unknown): ChatSettings => {
  const next = sanitizeChatSettings(value)
  settingsStore.set('chat', next)
  return next
}

export const parseApiKey = (value: unknown): string => {
  const key = typeof value === 'string' ? value.trim() : ''
  // API keys are single-line printable ASCII; anything else is a paste mistake.
  if (!key || key.length > MAX_KEY_LENGTH || !/^[\x21-\x7e]+$/u.test(key)) {
    throw new Error('API 키 형식이 올바르지 않아. 앞뒤 공백 없이 다시 붙여넣어 줘.')
  }
  return key
}

export const readByokKey = (provider: ByokProvider): string | null => {
  const stored = byokKeysStore.get('keys')[provider]
  if (!stored || !safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'))
  } catch {
    // Encrypted by another Windows account or machine; treat as no key.
    return null
  }
}

export const saveByokKey = (provider: ByokProvider, apiKey: string): void => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('이 컴퓨터에서는 키를 안전하게 암호화할 수 없어서 저장하지 않았어.')
  }
  const encrypted = safeStorage.encryptString(apiKey).toString('base64')
  byokKeysStore.set('keys', { ...byokKeysStore.get('keys'), [provider]: encrypted })
}

export const deleteByokKey = (provider: ByokProvider): void => {
  const keys = { ...byokKeysStore.get('keys') }
  delete keys[provider]
  byokKeysStore.set('keys', keys)
}

export const readByokStatus = (): ByokStatus => {
  const keys = {} as ByokStatus['keys']
  for (const provider of BYOK_PROVIDERS) {
    const key = readByokKey(provider)
    keys[provider] = { saved: key !== null, hint: key ? key.slice(-4) : null }
  }
  return { encryptionAvailable: safeStorage.isEncryptionAvailable(), keys }
}
