import type { AppConfig } from './config.js'
import type { AiUsage, ChatTurn } from './types.js'

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

const SYSTEM_PROMPT = `너는 사용자의 책상 위에서 함께 지내는 작은 햄스터 친구 '햄이(Hami)'야.
항상 자연스럽고 친근한 한국어 반말로 대답해.
이름을 물으면 반드시 "내 이름은 햄이야!"라고 대답해.
짧고 따뜻하게 답하고, 과도한 이모지나 훈계조 표현은 피해야 해.
너에게는 사용자의 일정, 할 일, 일기, 뽀모도로 데이터가 제공되지 않아. 모르는 개인정보나 기록을 알고 있는 것처럼 말하지 마.`

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
          { role: 'system', content: SYSTEM_PROMPT },
          ...history,
          { role: 'user', content: message }
        ],
        max_completion_tokens: 300
      })
    })
    if (!response.ok) {
      throw new Error(`AI 제공사 요청 실패: ${response.status}`)
    }
    const body = (await response.json()) as ChatCompletionResponse
    const reply = body.choices?.[0]?.message?.content?.trim()
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
