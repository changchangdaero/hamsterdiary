export type ChatRole = 'user' | 'assistant'

export interface ChatTurn {
  role: ChatRole
  content: string
}

export interface ChatRequest {
  installationId: string
  appVersion: string
  message: string
  history: ChatTurn[]
}

export interface ChatSuccessResponse {
  reply: string
  remainingDailyUsage: number
  remainingMonthlyUsage: number
}

export interface AiUsage {
  inputTokens: number
  outputTokens: number
}
