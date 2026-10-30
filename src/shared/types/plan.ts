export interface DailyPlan {
  date: string
  text: string
  updatedAt: string
  hamsterReply?: string
  commentedAt?: string
}

export interface SaveDailyPlanPayload {
  date: string
  text: string
}

export type DailyPlanCommentStatus =
  | 'ok'
  | 'empty'
  | 'limited'
  | 'not-configured'
  | 'error'

export interface DailyPlanCommentResult {
  status: DailyPlanCommentStatus
  truncated: boolean
  plan: DailyPlan | null
}
