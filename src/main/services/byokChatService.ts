// 내 API 키로 OpenAI·Gemini에 직접 대화를 보내는 서비스입니다. 햄이 서버를 거치지 않습니다.
import {
  HAMI_MAX_COMPLETION_TOKENS,
  HAMI_SYSTEM_PROMPT,
  trimToLastSentence
} from '../../shared/hamiPrompt'
import { BYOK_PROVIDER_INFO, type ByokProvider } from '../../shared/types/byok'
import type { ChatTurn } from '../../shared/types/chat'

const TIMEOUT_MS = 30_000

export type ByokFailure = 'invalid-key' | 'rate-limited' | 'bad-model' | 'failed'

// The tag in the message lets the chat box and plan comment pick a friendly reply.
export class ByokError extends Error {
  constructor(public readonly reason: ByokFailure, message: string) {
    super(`[BYOK_${reason.toUpperCase().replace('-', '_')}] ${message}`)
  }
}

const failureFor = (status: number, detail: string): ByokError => {
  // Google answers a bad key with 400 "API key not valid", not 401.
  if (status === 401 || status === 403 || /api[ _-]?key/iu.test(detail)) {
    return new ByokError('invalid-key', 'API 키가 맞지 않거나 권한이 없어.')
  }
  if (status === 429) {
    return new ByokError('rate-limited', '내 키의 사용 한도나 잔액이 부족해.')
  }
  if (status === 400 || status === 404) {
    return new ByokError('bad-model', '이 키로는 고른 모델을 쓸 수 없어.')
  }
  return new ByokError('failed', `AI 제공사 요청이 실패했어: ${status}`)
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
}

export const requestByokReply = async (options: {
  provider: ByokProvider
  model: string
  apiKey: string
  message: string
  history: ChatTurn[]
}): Promise<string> => {
  const info = BYOK_PROVIDER_INFO[options.provider]
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${info.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model,
        messages: [
          { role: 'system', content: HAMI_SYSTEM_PROMPT },
          ...options.history,
          { role: 'user', content: options.message }
        ],
        [info.tokenLimitParam]: HAMI_MAX_COMPLETION_TOKENS,
        ...(info.reasoningEffort ? { reasoning_effort: info.reasoningEffort } : {})
      })
    }).catch(() => {
      throw new ByokError('failed', 'AI 제공사에 연결하지 못했어.')
    })
    // The error body is read only to classify the failure; it is never logged.
    if (!response.ok) throw failureFor(response.status, await response.text().catch(() => ''))
    const body = (await response.json().catch(() => null)) as ChatCompletionResponse | null
    const choice = body?.choices?.[0]
    const content = choice?.message?.content?.trim() ?? ''
    const reply = choice?.finish_reason === 'length' ? trimToLastSentence(content) : content
    if (!reply) throw new ByokError('failed', 'AI 답변이 비어 있어.')
    return reply
  } finally {
    clearTimeout(timeout)
  }
}
