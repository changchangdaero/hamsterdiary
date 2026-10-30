// 여러 장으로 된 햄이 동작을 정해진 간격으로 넘겨 현재 프레임을 돌려주는 훅입니다.
import { useEffect, useState } from 'react'
import type { PetVisualFrame } from '../petAssets'
import type { PetClip } from '../petIdleBehaviors'

// playKey restarts the clip from its first frame.
export const usePetClipFrame = (
  clip: PetClip | null,
  playKey: number
): PetVisualFrame | null => {
  const [position, setPosition] = useState({ clip, playKey, index: 0 })

  useEffect(() => {
    setPosition({ clip, playKey, index: 0 })
    const interval = clip?.frameInterval
    if (!clip || clip.frames.length < 2 || !interval) return
    const count = clip.frames.length
    const startedAt = performance.now()
    let timer: ReturnType<typeof setTimeout>
    // Each step is scheduled from the start time, not the previous tick, so
    // late timers never stretch later frames and every frame gets the same length.
    const scheduleStep = (step: number): void => {
      if (!clip.loop && step >= count) return
      const delay = Math.max(0, startedAt + step * interval - performance.now())
      timer = setTimeout(() => {
        setPosition({ clip, playKey, index: clip.loop ? step % count : step })
        scheduleStep(step + 1)
      }, delay)
    }
    scheduleStep(1)
    return () => clearTimeout(timer)
  }, [clip, playKey])

  if (!clip) return null
  // Until the effect resets, a new clip or replay starts on its first frame.
  const index = position.clip === clip && position.playKey === playKey ? position.index : 0
  return clip.frames[Math.min(index, clip.frames.length - 1)]
}
