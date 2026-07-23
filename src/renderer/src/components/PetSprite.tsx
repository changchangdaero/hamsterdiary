// 기본 햄스터 이미지를 명확한 hitbox로 표시하는 펫 스프라이트 컴포넌트입니다.
import type { MouseEventHandler, PointerEventHandler } from 'react'
import idlePetImage from '../assets/pets/idle.png'

interface PetSpriteProps {
  onPointerDown: PointerEventHandler<HTMLDivElement>
  onPointerMove: PointerEventHandler<HTMLDivElement>
  onPointerUp: PointerEventHandler<HTMLDivElement>
  onPointerCancel: PointerEventHandler<HTMLDivElement>
  onClick: MouseEventHandler<HTMLDivElement>
}

function PetSprite(props: PetSpriteProps): React.JSX.Element {
  return (
    <div
      className="pet-hitbox"
      data-pet-hitbox
      onPointerDown={props.onPointerDown}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerCancel}
      onClick={props.onClick}
    >
      <img
        className="pet-sprite"
        src={idlePetImage}
        alt="화면 위에 앉아 있는 햄스터"
        draggable={false}
      />
    </div>
  )
}

export default PetSprite
