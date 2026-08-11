export const SCHEDULE_CONVERSATION_INTENTS = [
  'create',
  'list',
  'delete',
  'move',
  'cancel_conversation',
  'continue',
  'unknown'
] as const

export type ScheduleConversationIntent =
  (typeof SCHEDULE_CONVERSATION_INTENTS)[number]

export const SCHEDULE_CONVERSATION_PHASES = [
  'collecting',
  'confirming',
  'executing',
  'completed',
  'cancelled'
] as const

export type ScheduleConversationPhase =
  (typeof SCHEDULE_CONVERSATION_PHASES)[number]

export interface ScheduleConversationTurn {
  role: 'user' | 'assistant'
  text: string
}

export interface ScheduleConversationRequest {
  message: string
  history: ScheduleConversationTurn[]
}

export interface ScheduleConversationItem {
  title: string | null
  date: string | null
  time: string | null
  eventId: string | null
}

export interface ScheduleConversationResponse {
  intent: ScheduleConversationIntent
  phase: ScheduleConversationPhase
  items: ScheduleConversationItem[]
  reply: string
}
