// 햄이가 가끔 하는 동작과, 설정에서 미리 볼 수 있는 상황별 모습 목록입니다.
import {
  PET_ACTIVITY_DELAYS,
  type PetActivityLevel,
  type PetIdleActionId
} from '../../shared/types/pet'
import type { PetVisualFrame } from './petAssets'

export type { PetIdleActionId }

// A short clip of frames plus the CSS motion class that plays over it.
export interface PetClip {
  // One frame holds still; several frames play in order, frameInterval apart.
  frames: PetVisualFrame[]
  frameInterval?: number
  // Frames wrap around instead of stopping on the last one.
  loop?: boolean
  motionClass: string
  label: string
  description: string
}

export interface PetIdleAction extends PetClip {
  id: PetIdleActionId
  // Must match the `.action-<id>` animation length in styles.css.
  duration: number
  weight: number
}

// Clumsy "Toca Toca": paws up once, then paws left and right four times each.
// Every frame lasts exactly one interval so the beat stays even.
const TOCA_DANCE_FRAMES: PetVisualFrame[] = [
  'dance1', 'dance2', 'dance4', 'dance2', 'dance4', 'dance2', 'dance4', 'dance2', 'dance4'
]
const TOCA_DANCE_FRAME_INTERVAL = 400

const action = (
  id: PetIdleActionId,
  clip: Omit<PetClip, 'motionClass'>,
  duration: number,
  weight: number
): PetIdleAction => ({ id, ...clip, motionClass: `action-${id}`, duration, weight })

export const IDLE_ACTIONS: PetIdleAction[] = [
  action(
    'toca-dance',
    {
      frames: TOCA_DANCE_FRAMES,
      frameInterval: TOCA_DANCE_FRAME_INTERVAL,
      label: '토카토카 댄스',
      description: '하찮지만 진심인 춤을 춰요.'
    },
    TOCA_DANCE_FRAMES.length * TOCA_DANCE_FRAME_INTERVAL,
    1
  )
]

export const findIdleAction = (id: PetIdleActionId): PetIdleAction | undefined =>
  IDLE_ACTIONS.find((candidate) => candidate.id === id)

// States the hamster shows on its own; listed in settings for preview only.
export const PET_STATE_CLIPS: PetClip[] = [
  {
    frames: ['sleep0', 'sleep1', 'sleep2', 'sleep3'],
    frameInterval: 575,
    loop: true,
    motionClass: 'emotion-sleep',
    label: '잠자기',
    description: '입력이 없는 채로 정해둔 시간이 지나면 잠들어요.'
  },
  {
    frames: ['idle', 'talking'],
    frameInterval: 165,
    loop: true,
    motionClass: 'emotion-talking',
    label: '말하기',
    description: '말풍선으로 이야기할 때예요.'
  },
  {
    frames: ['happy'],
    motionClass: 'emotion-happy',
    label: '기뻐하기',
    description: '대화를 열거나 좋은 소식을 전할 때예요.'
  },
  {
    frames: ['thumbs-up'],
    motionClass: 'emotion-thumbsUp',
    label: '엄지척',
    description: '일정이나 할 일을 해냈을 때예요.'
  },
  {
    frames: ['question'],
    motionClass: 'emotion-question',
    label: '갸웃',
    description: '들어 옮길 때나 생각할 때예요.'
  },
  {
    frames: ['sad'],
    motionClass: 'emotion-sad',
    label: '시무룩',
    description: '연결이 안 되거나 아쉬운 소식일 때예요.'
  }
]

export const nextIdleActionDelay = (level: PetActivityLevel): number => {
  const [min, max] = PET_ACTIVITY_DELAYS[level]
  return min + Math.random() * (max - min)
}

// Weighted random pick among enabled actions, never repeating the previous one.
export const pickIdleAction = (
  previous: PetIdleActionId | null,
  disabled: readonly PetIdleActionId[]
): PetIdleAction | null => {
  const enabled = IDLE_ACTIONS.filter((candidate) => !disabled.includes(candidate.id))
  const candidates =
    enabled.length > 1 ? enabled.filter((candidate) => candidate.id !== previous) : enabled
  if (candidates.length === 0) return null
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0)
  let roll = Math.random() * total
  for (const candidate of candidates) {
    roll -= candidate.weight
    if (roll < 0) return candidate
  }
  return candidates[candidates.length - 1]
}
