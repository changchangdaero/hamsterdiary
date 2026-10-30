// 설정 화면에서 햄이 동작을 바탕화면 햄이와 같은 그림·움직임으로 반복 재생하는 미리보기입니다.
import { useEffect, useState } from 'react'
import { PET_FRAME_IMAGES } from '../petAssets'
import type { PetClip } from '../petIdleBehaviors'
import { usePetClipFrame } from '../hooks/usePetClipFrame'

interface Props {
  clip: PetClip
  // How long one play-through lasts before it starts over.
  cycleMs: number
}

// Pause between replays so a finished pose is visible for a moment.
const REPLAY_GAP_MS = 900

function PetClipPreview({ clip, cycleMs }: Props): React.JSX.Element {
  const [playKey, setPlayKey] = useState(0)
  const frame = usePetClipFrame(clip, playKey) ?? clip.frames[0]

  useEffect(() => {
    const timer = setInterval(() => setPlayKey((key) => key + 1), cycleMs + REPLAY_GAP_MS)
    return () => clearInterval(timer)
  }, [cycleMs])

  return (
    <button
      type="button"
      className="pet-clip-preview"
      aria-label={`${clip.label} 다시 보기`}
      onClick={() => setPlayKey((key) => key + 1)}
      onMouseEnter={() => setPlayKey((key) => key + 1)}
    >
      <span key={playKey} className={`pet-motion-wrapper ${clip.motionClass}`}>
        <img src={PET_FRAME_IMAGES[frame]} alt="" draggable={false} />
      </span>
    </button>
  )
}

export default PetClipPreview
