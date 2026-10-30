import type { ChatRequest, ChatTurn } from './types.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9a-z.-]+)?$/iu

const isTurn = (value: unknown, maxLength: number): value is ChatTurn => {
  if (typeof value !== 'object' || value === null) return false
  const turn = value as Record<string, unknown>
  return (
    (turn.role === 'user' || turn.role === 'assistant') &&
    typeof turn.content === 'string' &&
    turn.content.trim().length > 0 &&
    turn.content.length <= maxLength
  )
}

export const parseChatRequest = (
  value: unknown,
  maxMessageLength: number,
  maxHistoryItems: number
): ChatRequest => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('요청 형식이 올바르지 않아.')
  }
  const request = value as Record<string, unknown>
  const history = request.history ?? []
  if (
    typeof request.installationId !== 'string' ||
    !UUID_PATTERN.test(request.installationId) ||
    typeof request.appVersion !== 'string' ||
    !VERSION_PATTERN.test(request.appVersion) ||
    typeof request.message !== 'string' ||
    request.message.trim().length === 0 ||
    request.message.length > maxMessageLength ||
    !Array.isArray(history) ||
    history.length > maxHistoryItems ||
    !history.every((turn) => isTurn(turn, maxMessageLength))
  ) {
    throw new Error('요청 내용을 다시 확인해줘.')
  }
  return {
    installationId: request.installationId.toLowerCase(),
    appVersion: request.appVersion,
    message: request.message.trim(),
    history: history.map((turn) => ({
      role: turn.role,
      content: turn.content.trim()
    }))
  }
}
