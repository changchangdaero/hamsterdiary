export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface HamiChatRequest {
  message: string
  history: ChatTurn[]
}

export interface HamiUsagePeriod {
  limit: number
  remaining: number
  // When the period refills (local midnight / first of next month), as an ISO string.
  resetsAt: string
}

export interface HamiUsage {
  daily: HamiUsagePeriod
  monthly: HamiUsagePeriod
  // The whole-service monthly AI budget is spent; chat resumes next month.
  budgetPaused: boolean
}

export interface HamiChatResponse {
  reply: string
  remainingDailyUsage?: number
  remainingMonthlyUsage?: number
  // True when the server answered with its usage-limit notice (HTTP 429).
  limited?: boolean
}
