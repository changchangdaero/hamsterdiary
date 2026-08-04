// 펫 감정, 프레임 타이머, 말풍선, 클릭 통과와 드래그를 관리하는 화면입니다.
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import type {
  PetDragMovePayload,
  PetEmotion,
  PetScheduleInputPlacement,
  ResolvedPetMessage
} from '../../../shared/types/pet'
import PetSprite from '../components/PetSprite'
import PetScheduleInput from '../components/PetScheduleInput'
import SpeechBubble from '../components/SpeechBubble'
import {
  preloadPetImages,
  type PetVisualFrame
} from '../petAssets'

const DRAG_THRESHOLD = 5
const TALKING_FRAME_INTERVAL = 165
const SLEEP_FRAME_INTERVAL = 575
const BLINK_DURATION = 125
const BUBBLE_EXIT_DURATION = 160
const SLEEP_FRAMES: PetVisualFrame[] = [
  'sleep',
  'sleep-z1',
  'sleep-z2',
  'sleep-z3'
]

const toDragPayload = (
  screenX: unknown,
  screenY: unknown
): PetDragMovePayload | null => {
  if (
    typeof screenX !== 'number' ||
    typeof screenY !== 'number' ||
    !Number.isFinite(screenX) ||
    !Number.isFinite(screenY)
  ) {
    return null
  }

  return {
    screenX: Math.round(screenX),
    screenY: Math.round(screenY)
  }
}

const getStaticFrame = (emotion: PetEmotion): PetVisualFrame => {
  switch (emotion) {
    case 'question':
      return 'question'
    case 'sad':
      return 'sad'
    case 'thumbsUp':
      return 'thumbs-up'
    case 'happy':
      return 'happy'
    default:
      return 'idle'
  }
}

const segmentGraphemes = (text: string): string[] => {
  if ('Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), ({ segment }) => segment)
  }

  return Array.from(text)
}

const getTypingDelay = (grapheme: string, baseDelay: number): number => {
  if (/[.!?。！？]/u.test(grapheme)) {
    return baseDelay + 130
  }
  if (/[,，]/u.test(grapheme)) {
    return baseDelay + 65
  }
  if (grapheme === '\n') {
    return baseDelay + 80
  }
  return baseDelay
}

function PetWindow(): React.JSX.Element {
  const [emotion, setEmotion] = useState<PetEmotion>('idle')
  const [frame, setFrame] = useState<PetVisualFrame>('idle')
  const [animationKey, setAnimationKey] = useState(0)
  const [message, setMessage] = useState<ResolvedPetMessage | null>(null)
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isBubbleClosing, setIsBubbleClosing] = useState(false)
  const [scheduleInputPlacement, setScheduleInputPlacement] =
    useState<PetScheduleInputPlacement | null>(null)

  const pointerIdRef = useRef<number | null>(null)
  const pointerStartRef = useRef<PetDragMovePayload | null>(null)
  const latestMoveRef = useRef<PetDragMovePayload | null>(null)
  const capturedElementRef = useRef<HTMLDivElement | null>(null)
  const lastMousePositionRef = useRef({ clientX: -1, clientY: -1 })
  const animationFrameRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)
  const isInteractiveRef = useRef(false)
  const suppressClickRef = useRef(false)
  const suppressContextUntilRef = useRef(0)
  const typewriterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messageHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubbleExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messageSequenceRef = useRef(0)
  const currentMessageRef = useRef<ResolvedPetMessage | null>(null)
  const graphemesRef = useRef<string[]>([])
  const messageVisibleRef = useRef(false)

  const clearTimer = (
    timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  ): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const clearMessageTimers = (): void => {
    clearTimer(typewriterTimerRef)
    clearTimer(messageHideTimerRef)
    clearTimer(bubbleExitTimerRef)
  }

  const setInteractive = (interactive: boolean): void => {
    if (isInteractiveRef.current === interactive) {
      return
    }
    isInteractiveRef.current = interactive
    window.desktopPetAPI.setPetMouseInteractive(interactive)
  }

  const updateHitState = (clientX: number, clientY: number): void => {
    lastMousePositionRef.current = { clientX, clientY }
    if (pointerIdRef.current !== null) {
      setInteractive(true)
      return
    }

    const target = document.elementFromPoint(clientX, clientY)
    setInteractive(
      target?.closest('[data-interactive-hitbox="true"]') !== null
    )
  }

  const resetToIdle = (): void => {
    setEmotion('idle')
    setAnimationKey((key) => key + 1)
  }

  const closeMessage = (animate: boolean): void => {
    messageSequenceRef.current += 1
    clearMessageTimers()
    setIsTyping(false)
    currentMessageRef.current = null

    if (messageVisibleRef.current && animate) {
      setIsBubbleClosing(true)
      bubbleExitTimerRef.current = setTimeout(() => {
        messageVisibleRef.current = false
        setMessage(null)
        setDisplayedText('')
        setIsBubbleClosing(false)
        resetToIdle()
      }, BUBBLE_EXIT_DURATION)
    } else {
      messageVisibleRef.current = false
      setMessage(null)
      setDisplayedText('')
      setIsBubbleClosing(false)
      resetToIdle()
    }
  }

  const finishTyping = (
    activeMessage: ResolvedPetMessage,
    graphemes: string[]
  ): void => {
    clearTimer(typewriterTimerRef)
    setDisplayedText(graphemes.join(''))
    setIsTyping(false)
    setEmotion(activeMessage.finalEmotion)
    setAnimationKey((key) => key + 1)
    messageHideTimerRef.current = setTimeout(
      () => closeMessage(true),
      activeMessage.visibleDuration
    )
  }

  const startMessage = (nextMessage: ResolvedPetMessage): void => {
    messageSequenceRef.current += 1
    const sequence = messageSequenceRef.current
    clearMessageTimers()
    const graphemes = segmentGraphemes(nextMessage.text)
    currentMessageRef.current = nextMessage
    messageVisibleRef.current = true
    graphemesRef.current = graphemes
    setMessage(nextMessage)
    setDisplayedText('')
    setIsBubbleClosing(false)
    setIsTyping(graphemes.length > 0)
    setEmotion('talking')
    setAnimationKey((key) => key + 1)

    const typeNext = (index: number): void => {
      if (sequence !== messageSequenceRef.current) {
        return
      }
      if (index >= graphemes.length) {
        finishTyping(nextMessage, graphemes)
        return
      }

      typewriterTimerRef.current = setTimeout(() => {
        if (sequence !== messageSequenceRef.current) {
          return
        }
        setDisplayedText(graphemes.slice(0, index + 1).join(''))
        typeNext(index + 1)
      }, getTypingDelay(graphemes[index], nextMessage.typingSpeed))
    }

    typeNext(0)
  }

  const completeTyping = (): void => {
    const activeMessage = currentMessageRef.current
    if (!activeMessage || !isTyping) {
      return
    }

    messageSequenceRef.current += 1
    clearTimer(typewriterTimerRef)
    finishTyping(activeMessage, graphemesRef.current)
  }

  const applyEmotion = (nextEmotion: PetEmotion): void => {
    messageSequenceRef.current += 1
    clearMessageTimers()
    currentMessageRef.current = null
    messageVisibleRef.current = false
    setMessage(null)
    setDisplayedText('')
    setIsTyping(false)
    setIsBubbleClosing(false)
    setEmotion(nextEmotion)
    setAnimationKey((key) => key + 1)
  }

  const cancelRendererDrag = (): void => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    latestMoveRef.current = null

    const pointerId = pointerIdRef.current
    const capturedElement = capturedElementRef.current
    if (
      pointerId !== null &&
      capturedElement?.hasPointerCapture(pointerId)
    ) {
      capturedElement.releasePointerCapture(pointerId)
    }

    pointerIdRef.current = null
    pointerStartRef.current = null
    capturedElementRef.current = null
    isDraggingRef.current = false
    window.desktopPetAPI.endPetDrag()
  }

  useEffect(() => {
    preloadPetImages()
    const unsubscribeEmotion =
      window.desktopPetAPI.onPetEmotionChanged(applyEmotion)
    const unsubscribeMessage =
      window.desktopPetAPI.onPetMessageShown(startMessage)
    const unsubscribeMessageHidden =
      window.desktopPetAPI.onPetMessageHidden(() => closeMessage(true))
    const unsubscribeWindowHidden = window.desktopPetAPI.onPetWindowHidden(
      () => {
        cancelRendererDrag()
        closeMessage(false)
      }
    )
    const unsubscribeScheduleInputOpened =
      window.desktopPetAPI.onPetScheduleInputOpened(setScheduleInputPlacement)
    const unsubscribeScheduleInputClosed =
      window.desktopPetAPI.onPetScheduleInputClosed(() => {
        setScheduleInputPlacement(null)
      })

    return () => {
      unsubscribeEmotion()
      unsubscribeMessage()
      unsubscribeMessageHidden()
      unsubscribeWindowHidden()
      unsubscribeScheduleInputOpened()
      unsubscribeScheduleInputClosed()
      messageSequenceRef.current += 1
      clearMessageTimers()
      cancelRendererDrag()
      window.desktopPetAPI.setPetMouseInteractive(false)
    }
  }, [])

  useEffect(() => {
    let blinkDelayTimer: ReturnType<typeof setTimeout> | null = null
    let blinkFrameTimer: ReturnType<typeof setTimeout> | null = null
    let frameInterval: ReturnType<typeof setInterval> | null = null

    if (emotion === 'idle') {
      setFrame('idle')
      const scheduleBlink = (): void => {
        const delay = 3_500 + Math.random() * 3_500
        blinkDelayTimer = setTimeout(() => {
          setFrame('blink')
          blinkFrameTimer = setTimeout(() => {
            setFrame('idle')
            scheduleBlink()
          }, BLINK_DURATION)
        }, delay)
      }
      scheduleBlink()
    } else if (emotion === 'talking' && isTyping) {
      setFrame('idle')
      frameInterval = setInterval(() => {
        setFrame((currentFrame) =>
          currentFrame === 'talking' ? 'idle' : 'talking'
        )
      }, TALKING_FRAME_INTERVAL)
    } else if (emotion === 'sleep') {
      let index = 0
      setFrame(SLEEP_FRAMES[index])
      frameInterval = setInterval(() => {
        index = (index + 1) % SLEEP_FRAMES.length
        setFrame(SLEEP_FRAMES[index])
      }, SLEEP_FRAME_INTERVAL)
    } else {
      setFrame(getStaticFrame(emotion))
    }

    return () => {
      if (blinkDelayTimer !== null) clearTimeout(blinkDelayTimer)
      if (blinkFrameTimer !== null) clearTimeout(blinkFrameTimer)
      if (frameInterval !== null) clearInterval(frameInterval)
    }
  }, [emotion, isTyping])

  useEffect(() => {
    const { clientX, clientY } = lastMousePositionRef.current
    const frameId = requestAnimationFrame(() => {
      if (clientX >= 0 && clientY >= 0) {
        updateHitState(clientX, clientY)
      }
    })
    return () => cancelAnimationFrame(frameId)
  }, [message, isBubbleClosing, scheduleInputPlacement])

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
    }
  }, [])

  const flushLatestMove = (): void => {
    animationFrameRef.current = null
    const coordinates = latestMoveRef.current
    latestMoveRef.current = null
    if (
      coordinates &&
      isDraggingRef.current &&
      pointerIdRef.current !== null
    ) {
      window.desktopPetAPI.movePetDrag(coordinates)
    }
  }

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>
  ): void => {
    if (event.button !== 0 || pointerIdRef.current !== null) {
      return
    }

    const payload = toDragPayload(event.screenX, event.screenY)
    if (payload === null) {
      return
    }

    if (scheduleInputPlacement) {
      window.desktopPetAPI.closePetScheduleInput()
    }

    pointerIdRef.current = event.pointerId
    pointerStartRef.current = payload
    capturedElementRef.current = event.currentTarget
    isDraggingRef.current = false
    suppressClickRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
    setInteractive(true)
    window.desktopPetAPI.beginPetDrag(payload)
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

    const payload = toDragPayload(event.screenX, event.screenY)
    if (payload === null) {
      return
    }
    latestMoveRef.current = payload
    if (animationFrameRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(flushLatestMove)
    }
  }

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }

    const wasDragging = isDraggingRef.current
    const pendingMove = latestMoveRef.current
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    latestMoveRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (wasDragging && pendingMove !== null) {
      window.desktopPetAPI.movePetDrag(pendingMove)
    }
    window.desktopPetAPI.endPetDrag()
    pointerIdRef.current = null
    pointerStartRef.current = null
    capturedElementRef.current = null
    isDraggingRef.current = false
    if (wasDragging) {
      suppressContextUntilRef.current = performance.now() + 300
    }
    updateHitState(event.clientX, event.clientY)
  }

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (suppressClickRef.current) {
      event.preventDefault()
      event.stopPropagation()
      suppressClickRef.current = false
    }
  }

  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    if (
      isDraggingRef.current ||
      performance.now() < suppressContextUntilRef.current
    ) {
      return
    }
    window.desktopPetAPI.showPetContextMenu()
  }

  return (
    <main
      className="pet-window"
      style={
        scheduleInputPlacement
          ? ({
              '--pet-stage-center-x': `${scheduleInputPlacement.petCenterX}px`
            } as React.CSSProperties)
          : undefined
      }
    >
      {message && (
        <SpeechBubble
          text={displayedText}
          isClosing={isBubbleClosing}
          isTyping={isTyping}
          onCompleteTyping={completeTyping}
        />
      )}
      {scheduleInputPlacement && (
        <PetScheduleInput
          side={scheduleInputPlacement.side}
          onClose={() => window.desktopPetAPI.closePetScheduleInput()}
        />
      )}
      <PetSprite
        emotion={emotion}
        frame={frame}
        animationKey={animationKey}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />
    </main>
  )
}

export default PetWindow
