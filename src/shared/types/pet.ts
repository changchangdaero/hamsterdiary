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
}

export interface PetDragMovePayload {
  screenX: number
  screenY: number
}

export interface PetScheduleInputPlacement {
  side: 'left' | 'right'
  petCenterX: number
}
