import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import type { HamiChatRequest, HamiChatResponse, HamiUsage } from '../../shared/types/chat'
import { runtimeStore } from '../stores'
import { requestByokReply } from './byokChatService'
import { readByokKey, readChatSettings } from './byokKeyService'

const CHAT_API_URL = (
  import.meta.env as unknown as Record<string, string | undefined>
).MAIN_VITE_HAMI_CHAT_API_URL?.trim() ?? ''
const TIMEOUT_MS = 35_000

const installationId = (): string => {
  const stored = runtimeStore.get('installationId')?.trim()
  if (stored) return stored
  const created = randomUUID()
  runtimeStore.set('installationId', created)
  return created
}

const validateRequest = (request: HamiChatRequest): HamiChatRequest => {
  if (
    typeof request?.message !== 'string' ||
    request.message.trim().length === 0 ||
    request.message.length > 1_000 ||
    !Array.isArray(request.history) ||
    request.history.length > 5 ||
    !request.history.every(
      (turn) =>
        (turn.role === 'user' || turn.role === 'assistant') &&
        typeof turn.content === 'string' &&
        turn.content.length <= 1_000
    )
  ) {
    throw new Error('[HAMI_CHAT_INVALID] 대화 내용을 다시 확인해줘.')
  }
  return {
    message: request.message.trim(),
    history: request.history.map((turn) => ({
      role: turn.role,
      content: turn.content.trim()
    }))
  }
}

// Own-key mode talks to the chosen provider directly; the Hami server never sees it.
const converseWithOwnKey = async (request: HamiChatRequest): Promise<HamiChatResponse> => {
  const { provider, models } = readChatSettings()
  const apiKey = readByokKey(provider)
  if (!apiKey) {
    throw new Error('[BYOK_NO_KEY] 내 API 키가 아직 저장되지 않았어.')
  }
  const reply = await requestByokReply({
    provider,
    model: models[provider],
    apiKey,
    message: request.message,
    history: request.history
  })
  return { reply, byok: true }
}

export const converseWithHami = async (
  rawRequest: HamiChatRequest
): Promise<HamiChatResponse> => {
  const request = validateRequest(rawRequest)
  if (readChatSettings().mode === 'byok') return converseWithOwnKey(request)
  if (!CHAT_API_URL) {
    throw new Error('[HAMI_CHAT_NOT_CONFIGURED] AI 대화 서버가 아직 연결되지 않았어.')
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        installationId: installationId(),
        appVersion: app.getVersion(),
        ...request
      })
    })
    const body = (await response.json().catch(() => null)) as HamiChatResponse | null
    if (body?.reply && (response.ok || response.status === 429)) {
      return { ...body, limited: response.status === 429 }
    }
    throw new Error(`[HAMI_CHAT_FAILED] AI 대화 서버 오류: ${response.status}`)
  } finally {
    clearTimeout(timeout)
  }
}

const USAGE_TIMEOUT_MS = 10_000

// Remaining chats for this installation. Reading it does not use a chat.
export const getHamiUsage = async (): Promise<HamiUsage> => {
  if (!CHAT_API_URL) {
    throw new Error('[HAMI_CHAT_NOT_CONFIGURED] AI 대화 서버가 아직 연결되지 않았어.')
  }
  // The usage endpoint sits next to the chat endpoint: .../v1/chat -> .../v1/usage
  const url = new URL('usage', CHAT_API_URL)
  url.searchParams.set('installationId', installationId())
  url.searchParams.set('appVersion', app.getVersion())
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), USAGE_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    const body = (await response.json().catch(() => null)) as HamiUsage | null
    if (!response.ok || !body?.daily || !body.monthly) {
      throw new Error(`[HAMI_USAGE_FAILED] 사용량을 불러오지 못했어: ${response.status}`)
    }
    return body
  } finally {
    clearTimeout(timeout)
  }
}
