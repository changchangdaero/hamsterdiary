export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface HamiChatRequest {
  message: string
  history: ChatTurn[]
}

export interface HamiChatResponse {
  reply: string
  remainingDailyUsage?: number
  remainingMonthlyUsage?: number
  // True when the server answered with its usage-limit notice (HTTP 429).
  limited?: boolean
}
