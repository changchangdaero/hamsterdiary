// 펫 hit 상태와 임계값 기반 수동 드래그를 관리하는 투명 펫 화면입니다.
import {
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import PetSprite from '../components/PetSprite'

const DRAG_THRESHOLD = 5

interface PointerCoordinates {
  screenX: number
  screenY: number
}

function PetWindow(): React.JSX.Element {
  const pointerIdRef = useRef<number | null>(null)
  const pointerStartRef = useRef<PointerCoordinates | null>(null)
  const latestMoveRef = useRef<PointerCoordinates | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)
  const isInteractiveRef = useRef(false)
  const suppressClickRef = useRef(false)

  const setInteractive = (interactive: boolean): void => {
    if (isInteractiveRef.current === interactive) {
      return
    }
    isInteractiveRef.current = interactive
    window.desktopPetAPI.setPetMouseInteractive(interactive)
  }

  const updateHitState = (clientX: number, clientY: number): void => {
    if (pointerIdRef.current !== null) {
      setInteractive(true)
      return
    }

    const target = document.elementFromPoint(clientX, clientY)
    setInteractive(target?.closest('[data-pet-hitbox]') !== null)
  }

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent): void => {
      updateHitState(event.clientX, event.clientY)
    }
    const handleMouseLeave = (): void => {
      if (pointerIdRef.current === null) {
        setInteractive(false)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.documentElement.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave)
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      window.desktopPetAPI.endPetDrag()
      window.desktopPetAPI.setPetMouseInteractive(false)
    }
  }, [])

  const flushLatestMove = (): void => {
    animationFrameRef.current = null
    const coordinates = latestMoveRef.current
    latestMoveRef.current = null
    if (coordinates) {
      window.desktopPetAPI.movePetDrag(coordinates.screenX, coordinates.screenY)
    }
  }

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>
  ): void => {
    if (event.button !== 0 || pointerIdRef.current !== null) {
      return
    }

    pointerIdRef.current = event.pointerId
    pointerStartRef.current = { screenX: event.screenX, screenY: event.screenY }
    isDraggingRef.current = false
    suppressClickRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
    setInteractive(true)
    window.desktopPetAPI.beginPetDrag(event.screenX, event.screenY)
  }

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLDivElement>
  ): void => {
    const start = pointerStartRef.current
    if (pointerIdRef.current !== event.pointerId || !start) {
      return
    }

    if (!isDraggingRef.current) {
      const distance = Math.hypot(
        event.screenX - start.screenX,
        event.screenY - start.screenY
      )
      if (distance < DRAG_THRESHOLD) {
        return
      }
      isDraggingRef.current = true
      suppressClickRef.current = true
    }

    latestMoveRef.current = { screenX: event.screenX, screenY: event.screenY }
    if (animationFrameRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(flushLatestMove)
    }
  }

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
      flushLatestMove()
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    window.desktopPetAPI.endPetDrag()
    pointerIdRef.current = null
    pointerStartRef.current = null
    isDraggingRef.current = false
    updateHitState(event.clientX, event.clientY)
  }

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (suppressClickRef.current) {
      event.preventDefault()
      event.stopPropagation()
      suppressClickRef.current = false
    }
  }

  return (
    <main className="pet-stage">
      <PetSprite
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onClick={handleClick}
      />
    </main>
  )
}

export default PetWindow
