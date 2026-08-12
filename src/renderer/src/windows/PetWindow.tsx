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
import type { PomodoroState } from '../../../shared/types/pomodoro'
import PetSprite from '../components/PetSprite'
import PetScheduleInput from '../components/PetScheduleInput'
import SpeechBubble from '../components/SpeechBubble'
import { SpeechBubbleFrame } from '../components/SpeechBubble'
import {
  preloadPetImages,
  type PetVisualFrame
} from '../petAssets'

const DRAG_THRESHOLD = 5
const TALKING_FRAME_INTERVAL = 165
const SLEEP_FRAME_INTERVAL = 575
const BLINK_DURATION = 125
const BUBBLE_EXIT_DURATION = 160
const IDLE_POSE_MIN_DELAY = 25_000
const IDLE_POSE_MAX_DELAY = 35_000
const IDLE_SLEEP_DURATION = 30_000
const COMPLETION_POSE_DURATION = 1_800
const SLEEP_FRAMES: PetVisualFrame[] = [
  'sleep',
  'sleep-z1',
  'sleep-z2',
  'sleep-z3'
]

const formatRemainingTime = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`
}

const logPetStageRect = (state: 'opening' | 'opened' | 'closing' | 'closed'): void => {
  const rect = document.querySelector('.pet-stage')?.getBoundingClientRect()
  console.log('[pet:schedule-input] renderer layout', {
    state,
    rect: rect
      ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      : null
  })
}

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
  const [idlePose, setIdlePose] = useState<PetEmotion | null>(null)
  const [isPointerActive, setIsPointerActive] = useState(false)
  const [isDraggingVisual, setIsDraggingVisual] = useState(false)
  const [completionPose, setCompletionPose] = useState(false)
  const [pomodoroState, setPomodoroState] = useState<PomodoroState | null>(null)
  const [scheduleInputPlacement, setScheduleInputPlacement] =
    useState<PetScheduleInputPlacement | null>(null)
  const visualEmotion: PetEmotion = completionPose
    ? 'thumbsUp'
    : scheduleInputPlacement
      ? 'happy'
      : isDraggingVisual
        ? 'question'
        : pomodoroState?.runState === 'running'
          ? pomodoroState.mode === 'focus'
            ? 'talking'
            : 'sleep'
        : idlePose ?? emotion

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
  const idlePoseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completionPoseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFocusActiveRef = useRef(false)

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
    setIdlePose(null)
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
    setIdlePose(null)
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

  useEffect(() => {
    if (!isTyping) return
    const skipTypingOnKey = (): void => completeTyping()
    window.addEventListener('keydown', skipTypingOnKey)
    return () => window.removeEventListener('keydown', skipTypingOnKey)
  }, [isTyping])

  const applyEmotion = (nextEmotion: PetEmotion): void => {
    messageSequenceRef.current += 1
    clearMessageTimers()
    currentMessageRef.current = null
    messageVisibleRef.current = false
    setMessage(null)
    setDisplayedText('')
    setIsTyping(false)
    setIsBubbleClosing(false)
    setIdlePose(null)
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
    setIsPointerActive(false)
    setIsDraggingVisual(false)
    window.desktopPetAPI.endPetDrag()
  }

  useEffect(() => {
    preloadPetImages()
    const unsubscribeEmotion =
      window.desktopPetAPI.onPetEmotionChanged(applyEmotion)
    const unsubscribeMessage = window.desktopPetAPI.onPetMessageShown(
      (nextMessage) => {
        if (!isFocusActiveRef.current) startMessage(nextMessage)
      }
    )
    const unsubscribeMessageHidden =
      window.desktopPetAPI.onPetMessageHidden(() => closeMessage(true))
    const unsubscribeWindowHidden = window.desktopPetAPI.onPetWindowHidden(
      () => {
        cancelRendererDrag()
        closeMessage(false)
      }
    )
    const unsubscribeScheduleInputOpened =
      window.desktopPetAPI.onPetScheduleInputOpened((placement) => {
        logPetStageRect('opening')
        setScheduleInputPlacement(placement)
        requestAnimationFrame(() => logPetStageRect('opened'))
      })
    const unsubscribeScheduleInputClosed =
      window.desktopPetAPI.onPetScheduleInputClosed(() => {
        logPetStageRect('closing')
        setScheduleInputPlacement(null)
        requestAnimationFrame(() => logPetStageRect('closed'))
      })
    const unsubscribeSchedulesChanged =
      window.desktopPetAPI.onSchedulesChanged(() => {
        if (completionPoseTimerRef.current !== null) {
          clearTimeout(completionPoseTimerRef.current)
        }
        setCompletionPose(true)
        setAnimationKey((key) => key + 1)
        completionPoseTimerRef.current = setTimeout(() => {
          setCompletionPose(false)
          setAnimationKey((key) => key + 1)
          completionPoseTimerRef.current = null
        }, COMPLETION_POSE_DURATION)
      })
    const unsubscribePomodoro =
      window.desktopPetAPI.onPomodoroChanged(setPomodoroState)
    void window.desktopPetAPI.getPomodoroState().then(setPomodoroState).catch(() => undefined)

    return () => {
      unsubscribeEmotion()
      unsubscribeMessage()
      unsubscribeMessageHidden()
      unsubscribeWindowHidden()
      unsubscribeScheduleInputOpened()
      unsubscribeScheduleInputClosed()
      unsubscribeSchedulesChanged()
      unsubscribePomodoro()
      messageSequenceRef.current += 1
      clearMessageTimers()
      if (completionPoseTimerRef.current !== null) {
        clearTimeout(completionPoseTimerRef.current)
      }
      cancelRendererDrag()
      window.desktopPetAPI.setPetMouseInteractive(false)
    }
  }, [])

  const isFocusActive =
    pomodoroState?.mode === 'focus' && pomodoroState.runState === 'running'

  useEffect(() => {
    isFocusActiveRef.current = isFocusActive
    if (isFocusActive) {
      closeMessage(false)
      setIdlePose(null)
    }
  }, [isFocusActive])

  useEffect(() => {
    const clearIdlePoseTimer = (): void => {
      if (idlePoseTimerRef.current !== null) {
        clearTimeout(idlePoseTimerRef.current)
        idlePoseTimerRef.current = null
      }
    }

    const canPlayIdlePose =
      emotion === 'idle' &&
      message === null &&
      scheduleInputPlacement === null &&
      !isPointerActive &&
      !completionPose
      && pomodoroState?.runState !== 'running'

    if (!canPlayIdlePose) {
      clearIdlePoseTimer()
      setIdlePose(null)
      return clearIdlePoseTimer
    }

    const scheduleNextPose = (): void => {
      const delay =
        IDLE_POSE_MIN_DELAY +
        Math.random() * (IDLE_POSE_MAX_DELAY - IDLE_POSE_MIN_DELAY)
      idlePoseTimerRef.current = setTimeout(() => {
        setIdlePose('sleep')
        setAnimationKey((key) => key + 1)

        idlePoseTimerRef.current = setTimeout(() => {
          setIdlePose(null)
          setAnimationKey((key) => key + 1)
          scheduleNextPose()
        }, IDLE_SLEEP_DURATION)
      }, delay)
    }

    scheduleNextPose()
    return clearIdlePoseTimer
  }, [
    completionPose,
    emotion,
    isPointerActive,
    message,
    pomodoroState?.runState,
    scheduleInputPlacement
  ])

  useEffect(() => {
    let blinkDelayTimer: ReturnType<typeof setTimeout> | null = null
    let blinkFrameTimer: ReturnType<typeof setTimeout> | null = null
    let frameInterval: ReturnType<typeof setInterval> | null = null

    const activeEmotion = visualEmotion

    if (activeEmotion === 'idle') {
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
    } else if (activeEmotion === 'talking') {
      setFrame('idle')
      frameInterval = setInterval(() => {
        setFrame((currentFrame) =>
          currentFrame === 'talking' ? 'idle' : 'talking'
        )
      }, TALKING_FRAME_INTERVAL)
    } else if (activeEmotion === 'sleep') {
      let index = 0
      setFrame(SLEEP_FRAMES[index])
      frameInterval = setInterval(() => {
        index = (index + 1) % SLEEP_FRAMES.length
        setFrame(SLEEP_FRAMES[index])
      }, SLEEP_FRAME_INTERVAL)
    } else {
      setFrame(getStaticFrame(activeEmotion))
    }

    return () => {
      if (blinkDelayTimer !== null) clearTimeout(blinkDelayTimer)
      if (blinkFrameTimer !== null) clearTimeout(blinkFrameTimer)
      if (frameInterval !== null) clearInterval(frameInterval)
    }
  }, [isTyping, visualEmotion])

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

    pointerIdRef.current = event.pointerId
    setIsPointerActive(true)
    pointerStartRef.current = payload
    capturedElementRef.current = event.currentTarget
    isDraggingRef.current = false
    setIsDraggingVisual(false)
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
      setIsDraggingVisual(true)
      setAnimationKey((key) => key + 1)
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
    setIsPointerActive(false)
    setIsDraggingVisual(false)
    if (wasDragging) {
      suppressContextUntilRef.current = performance.now() + 300
    }
    updateHitState(event.clientX, event.clientY)
  }

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (scheduleInputPlacement) {
      event.preventDefault()
      event.stopPropagation()
      suppressClickRef.current = false
      return
    }
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
      className={`pet-window${scheduleInputPlacement ? ' is-chatting' : ''}`}
      style={
        scheduleInputPlacement
          ? ({
              '--pet-stage-center-x': `${scheduleInputPlacement.petCenterX}px`
            } as React.CSSProperties)
          : undefined
      }
    >
      {isFocusActive && !scheduleInputPlacement && (
        <SpeechBubbleFrame className="focus-timer-bubble">
          <span aria-live="off">
            {formatRemainingTime(pomodoroState.remainingSeconds)}
          </span>
        </SpeechBubbleFrame>
      )}
      {!isFocusActive && message && !scheduleInputPlacement && (
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
        emotion={visualEmotion}
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
