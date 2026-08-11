import type { GeminiKeyStatus } from '../../shared/types/geminiKey'
import { credentialsStore } from '../stores'

const normalizeKey = (value: string): string => value.trim()

export const getGeminiKeyStatus = (): GeminiKeyStatus => ({
  configured: Boolean(credentialsStore.get('geminiApiKey')?.trim())
})

export const getGeminiApiKey = (): string => {
  const key = credentialsStore.get('geminiApiKey')?.trim()
  if (!key) throw new Error('[GEMINI_KEY_MISSING] Gemini API 키가 설정되지 않았습니다.')
  return key
}

export const saveGeminiApiKey = (value: unknown): GeminiKeyStatus => {
  if (typeof value !== 'string') throw new Error('API 키 형식이 올바르지 않습니다.')
  const key = normalizeKey(value)
  if (key.length < 20 || key.length > 500 || /\s/u.test(key)) {
    throw new Error('API 키 형식이 올바르지 않습니다.')
  }
  credentialsStore.set('geminiApiKey', key)
  return getGeminiKeyStatus()
}

export const deleteGeminiApiKey = (): GeminiKeyStatus => {
  credentialsStore.set('geminiApiKey', null)
  return getGeminiKeyStatus()
}

