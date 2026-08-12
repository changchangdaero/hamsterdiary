import { fetchGeminiQueued } from './geminiRequestQueue'
import { getGeminiApiKey } from './geminiKeyService'

const GEMINI_MODEL = 'gemini-3.5-flash-lite'
const TIMEOUT_MS = 75_000

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
}

const SYSTEM_INSTRUCTION = `너는 사용자의 책상 위에서 함께 지내는 작은 햄스터 친구다.
사용자의 일기를 읽고 한국어 반말로 친근하고 따뜻하게 답한다.
반드시 일기에 나온 실제 사건이나 감정을 구체적으로 언급해라. 어느 일기에도 붙일 수 있는 일반론적인 위로는 하지 마라.
답은 자연스러운 3~4문장으로만 작성하고 길게 늘어놓지 마라.
상담사처럼 진단하거나 가르치려 들지 마라. "~해야 해", "당신은 소중한 사람"처럼 뻔하거나 훈계하는 표현을 피한다.
힘든 내용이면 먼저 구체적으로 공감한 뒤 부담 없는 아주 작은 응원을 얹어라. 좋은 하루였으면 그 사건을 짚으며 함께 기뻐해라.
과장된 호들갑, 이모지 남발, 억지로 밝게 돌리는 태도를 피하고 담백하고 진심 있게 말한다.
일기에 자해, 극단적 선택, 죽고 싶다는 표현 등 심각한 정서적 위기가 보이면 가벼운 응원으로 넘기지 마라. 햄스터 친구의 따뜻한 반말 톤을 유지하면서 마음을 구체적으로 인정하고, 지금 혼자 있지 말고 믿을 만한 주변 사람이나 지역 응급·위기 지원에 바로 도움을 청하도록 분명히 권해라. 즉각적인 위험이 느껴지면 응급 서비스에 연락하라는 문장을 포함해라.`

const readResponse = async (response: Response): Promise<string> => {
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    if (
      response.status === 401 ||
      response.status === 403 ||
      /API_KEY_INVALID|API key not valid|invalid api key/iu.test(body)
    ) {
      throw new Error('[GEMINI_KEY_INVALID] Gemini API 키를 확인해 주세요.')
    }
    throw new Error(`[GEMINI_REQUEST_FAILED] Gemini API 오류: ${response.status}`)
  }
  const body = (await response.json()) as GeminiResponse
  const reply = body.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim()
  if (!reply) throw new Error('[GEMINI_EMPTY_RESPONSE] 햄스터의 답변이 비어 있습니다.')
  return reply
}

export const createDiaryComfort = async (date: string, text: string): Promise<string> => {
  const apiKey = getGeminiApiKey()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetchGeminiQueued(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [
            {
              role: 'user',
              parts: [{ text: `${date}의 일기야. 이 내용에 반응해 줘.\n\n${text}` }]
            }
          ],
          generationConfig: {
            temperature: 0.75,
            maxOutputTokens: 320
          }
        })
      }
    )
    return await readResponse(response)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('[GEMINI_TIMEOUT] 햄스터가 답을 생각하는 데 너무 오래 걸렸습니다.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
