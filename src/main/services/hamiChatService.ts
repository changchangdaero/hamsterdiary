import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import type { HamiChatRequest, HamiChatResponse } from '../../shared/types/chat'
import { runtimeStore } from '../stores'

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

export const converseWithHami = async (
  rawRequest: HamiChatRequest
): Promise<HamiChatResponse> => {
  if (!CHAT_API_URL) {
    throw new Error('[HAMI_CHAT_NOT_CONFIGURED] AI 대화 서버가 아직 연결되지 않았어.')
  }
  const request = validateRequest(rawRequest)
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
