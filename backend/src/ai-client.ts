import type { AppConfig } from './config.js'
import type { AiUsage, ChatTurn } from './types.js'
import { HAMI_EXAMPLE_TURNS, HAMI_SYSTEM_PROMPT, trimToLastSentence } from '../../src/shared/hamiPrompt.js'

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

// The prompt and trimming rules are shared with the desktop app's own-key (BYOK) chat.
export { trimToLastSentence }

export const requestAiReply = async (
  apiKey: string,
  message: string,
  history: ChatTurn[],
  config: AppConfig
): Promise<{ reply: string; usage: AiUsage }> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs)
  try {
    const response = await fetch(`${config.aiBaseUrl.replace(/\/$/u, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.aiModel,
        messages: [
          { role: 'system', content: HAMI_SYSTEM_PROMPT },
          ...HAMI_EXAMPLE_TURNS,
          ...history,
          { role: 'user', content: message }
        ],
        max_completion_tokens: config.maxCompletionTokens,
        // Without this, gpt-5 models can use the whole budget thinking and return no text.
        ...(config.aiReasoningEffort ? { reasoning_effort: config.aiReasoningEffort } : {})
      })
    })
    if (!response.ok) {
      throw new Error(`AI 제공사 요청 실패: ${response.status}`)
    }
    const body = (await response.json()) as ChatCompletionResponse
    const choice = body.choices?.[0]
    const content = choice?.message?.content?.trim() ?? ''
    const reply = choice?.finish_reason === 'length' ? trimToLastSentence(content) : content
    if (!reply) throw new Error('AI 답변이 비어 있습니다.')
    return {
      reply,
      usage: {
        inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0
      }
    }
  } finally {
    clearTimeout(timeout)
  }
}
