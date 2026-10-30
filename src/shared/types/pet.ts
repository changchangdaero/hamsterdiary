// 펫 감정과 말풍선 메시지에 사용하는 공용 데이터 타입을 정의하는 파일입니다.
export const PET_EMOTIONS = [
  'idle',
  'talking',
  'question',
  'sad',
  'sleep',
  'thumbsUp',
  'happy'
] as const

export type PetEmotion = (typeof PET_EMOTIONS)[number]

export interface PetMessagePayload {
  text: string
  finalEmotion?: PetEmotion
  typingSpeed?: number
  visibleDuration?: number
}

export interface ResolvedPetMessage {
  text: string
  finalEmotion: PetEmotion
  typingSpeed: number
  visibleDuration: number
  // Set only for replies the user just asked for, so focus mode does not swallow them.
  userRequested?: boolean
}

export interface PetDragMovePayload {
  screenX: number
  screenY: number
}

export interface PetScheduleInputPlacement {
  side: 'left' | 'right'
  petCenterX: number
}

// Idle actions the hamster can play; the renderer holds their frames and labels.
export const PET_IDLE_ACTION_IDS = ['toca-dance'] as const

export type PetIdleActionId = (typeof PET_IDLE_ACTION_IDS)[number]

export const PET_ACTIVITY_LEVELS = ['calm', 'normal', 'lively'] as const

export type PetActivityLevel = (typeof PET_ACTIVITY_LEVELS)[number]

// Range of milliseconds between idle actions for each activity level.
export const PET_ACTIVITY_DELAYS: Record<PetActivityLevel, [number, number]> = {
  calm: [45_000, 90_000],
  normal: [20_000, 45_000],
  lively: [10_000, 25_000]
}

export const PET_SLEEP_AFTER_MINUTES = [1, 3, 5, 10] as const

export type PetSleepAfterMinutes = (typeof PET_SLEEP_AFTER_MINUTES)[number]

export interface PetBehaviorSettings {
  // Actions left out of the random rotation; they can still be played on request.
  disabledActions: PetIdleActionId[]
  activityLevel: PetActivityLevel
  sleepAfterMinutes: PetSleepAfterMinutes
}

export const DEFAULT_PET_BEHAVIOR_SETTINGS: PetBehaviorSettings = {
  disabledActions: [],
  activityLevel: 'normal',
  sleepAfterMinutes: 3
}

export interface PetActionRequest {
  requestId: number
  actionId: PetIdleActionId
}

export interface PetActionResult {
  requestId: number
  played: boolean
}

export type PetActionPlayStatus = 'played' | 'busy'
