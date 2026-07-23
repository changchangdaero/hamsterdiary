// 감정 애니메이션과 현재 프레임을 적용해 햄스터 스프라이트를 표시하는 파일입니다.
import type {
  MouseEventHandler,
  PointerEventHandler
} from 'react'
import type { PetEmotion } from '../../../shared/types/pet'
import {
  PET_FRAME_IMAGES,
  type PetVisualFrame
} from '../petAssets'

interface PetSpriteProps {
  emotion: PetEmotion
  frame: PetVisualFrame
  animationKey: number
  onPointerDown: PointerEventHandler<HTMLDivElement>
  onPointerMove: PointerEventHandler<HTMLDivElement>
  onPointerUp: PointerEventHandler<HTMLDivElement>
  onPointerCancel: PointerEventHandler<HTMLDivElement>
  onClick: MouseEventHandler<HTMLDivElement>
  onContextMenu: MouseEventHandler<HTMLDivElement>
}

function PetSprite(props: PetSpriteProps): React.JSX.Element {
  return (
    <div className="pet-stage">
      <div
        className="pet-hitbox"
        data-pet-hitbox
        data-interactive-hitbox="true"
        onPointerDown={props.onPointerDown}
        onPointerMove={props.onPointerMove}
        onPointerUp={props.onPointerUp}
        onPointerCancel={props.onPointerCancel}
        onClick={props.onClick}
        onContextMenu={props.onContextMenu}
      >
        <div
          key={`${props.emotion}-${props.animationKey}`}
          className={`pet-motion-wrapper emotion-${props.emotion}`}
        >
          <img
            className="pet-sprite"
            src={PET_FRAME_IMAGES[props.frame]}
            alt="화면 위에서 감정을 표현하는 햄스터"
            draggable={false}
          />
        </div>
      </div>
    </div>
  )
}

export default PetSprite
