// AI 대화 방식(햄이 서버 / 내 API 키)과 내 키로 쓸 수 있는 제공사·모델 목록입니다.

export const CHAT_MODES = ['server', 'byok'] as const
export type ChatMode = (typeof CHAT_MODES)[number]

export const BYOK_PROVIDERS = ['openai', 'gemini'] as const
export type ByokProvider = (typeof BYOK_PROVIDERS)[number]

export interface ByokModel {
  id: string
  label: string
  hint: string
  // Sent to reasoning models so they do not spend the reply budget thinking.
  reasoningEffort?: string
  // Includes thinking tokens on Gemini, so models that must think need more room than the default.
  maxOutputTokens?: number
}

export interface ByokProviderInfo {
  label: string
  baseUrl: string
  keyPageUrl: string
  usagePageUrl: string
  // OpenAI's gpt-5 models take max_completion_tokens; Gemini's compatible API takes max_tokens.
  tokenLimitParam: 'max_completion_tokens' | 'max_tokens'
  models: ByokModel[]
}

export const BYOK_PROVIDER_INFO: Record<ByokProvider, ByokProviderInfo> = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    keyPageUrl: 'https://platform.openai.com/api-keys',
    usagePageUrl: 'https://platform.openai.com/usage',
    tokenLimitParam: 'max_completion_tokens',
    models: [
      { id: 'gpt-5-nano', label: 'gpt-5-nano', hint: '가장 저렴하고 빨라요 (햄이 서버와 같은 모델)', reasoningEffort: 'minimal' },
      { id: 'gpt-5-mini', label: 'gpt-5-mini', hint: '말이 더 자연스러워요. 비용은 약 5배', reasoningEffort: 'minimal' }
    ]
  },
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyPageUrl: 'https://aistudio.google.com/apikey',
    usagePageUrl: 'https://aistudio.google.com/apikey',
    tokenLimitParam: 'max_tokens',
    models: [
      { id: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite', hint: '빠르고 가벼워요. 무료 등급으로도 쓸 수 있어요', reasoningEffort: 'minimal', maxOutputTokens: 400 },
      // Thinking cannot be turned off on this model; low is its lowest level.
      { id: 'gemini-3.8-flash', label: 'gemini-3.8-flash', hint: '말이 더 자연스러워요. 무료 등급으로도 쓸 수 있어요', reasoningEffort: 'low', maxOutputTokens: 1000 }
    ]
  }
}

export interface ChatSettings {
  mode: ChatMode
  provider: ByokProvider
  // Model id per provider, so switching providers keeps each choice.
  models: Record<ByokProvider, string>
}

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  mode: 'server',
  provider: 'openai',
  models: { openai: 'gpt-5-nano', gemini: 'gemini-3.5-flash-lite' }
}

// What the settings screen may know about a saved key. The key itself never leaves the main process.
export interface ByokKeyStatus {
  saved: boolean
  // Last four characters, for recognising which key is saved.
  hint: string | null
}

export interface ByokStatus {
  // False when the OS cannot encrypt secrets; keys are then never stored.
  encryptionAvailable: boolean
  keys: Record<ByokProvider, ByokKeyStatus>
}

export interface SaveByokKeyPayload {
  provider: ByokProvider
  apiKey: string
}

export interface TestByokPayload {
  provider: ByokProvider
  model: string
  // A key typed but not yet saved; omitted to test the saved key.
  apiKey?: string
}

export type ByokTestResult =
  | { ok: true; reply: string }
  | { ok: false; reason: 'no-key' | 'invalid-key' | 'rate-limited' | 'bad-model' | 'failed'; message: string }
