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
  constructor(
    public readonly reason: ByokFailure,
    message: string,
    // The provider's own short explanation, shown only on the settings connection test.
    public readonly detail = ''
  ) {
    super(`[BYOK_${reason.toUpperCase().replace('-', '_')}] ${message}`)
  }
}

const UNAVAILABLE_MODEL =
  /model.*(?:not found|does not exist|not supported|not available|unavailable|no longer|access)|(?:unknown|invalid) model|access.*model/iu

// Sorts a provider error by what the user can do about it. `detail` is the provider's message.
export const classifyByokFailure = (status: number, detail: string): ByokError => {
  if (status === 429) {
    return new ByokError('rate-limited', '내 키의 사용 한도나 잔액이 부족해.')
  }
  // A key without access to one model also gets 403, so check the model wording first.
  if (status === 404 || ((status === 400 || status === 403) && UNAVAILABLE_MODEL.test(detail))) {
    return new ByokError('bad-model', '이 키로는 고른 모델을 쓸 수 없어.')
  }
  // Google answers a bad key with 400 "API key not valid", not 401.
  if (status === 401 || status === 403 || /api[ _-]?key/iu.test(detail)) {
    return new ByokError('invalid-key', 'API 키가 맞지 않거나 권한이 없어.')
  }
  return new ByokError('failed', `AI 제공사 요청이 실패했어: ${status}`, detail)
}

// The provider's message from an error body, trimmed, with the key removed in case it is echoed.
const providerDetail = (body: string, apiKey: string): string => {
  let message = ''
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } } | Array<{ error?: { message?: string } }>
    message = (Array.isArray(parsed) ? parsed[0]?.error?.message : parsed.error?.message) ?? ''
  } catch {
    message = ''
  }
  return message.split(apiKey).join('[key]').slice(0, 160)
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
  const model = info.models.find((candidate) => candidate.id === options.model)
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
        [info.tokenLimitParam]: model?.maxOutputTokens ?? HAMI_MAX_COMPLETION_TOKENS,
        ...(model?.reasoningEffort ? { reasoning_effort: model.reasoningEffort } : {})
      })
    }).catch(() => {
      throw new ByokError('failed', 'AI 제공사에 연결하지 못했어.')
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw classifyByokFailure(response.status, providerDetail(body, options.apiKey))
    }
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
