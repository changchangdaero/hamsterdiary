import { useEffect, useRef, useState } from 'react'

export const TYPEWRITER_CHARACTER_DELAY_MS = 28

const segmentGraphemes = (text: string): string[] => {
  if ('Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), ({ segment }) => segment)
  }
  return Array.from(text)
}

interface TypewriterTextProps {
  text: string
  characterDelay?: number
  onComplete?: () => void
}

function TypewriterText({
  text,
  characterDelay = TYPEWRITER_CHARACTER_DELAY_MS,
  onComplete
}: TypewriterTextProps): React.JSX.Element {
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(text.length > 0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sequenceRef = useRef(0)
  const onCompleteRef = useRef(onComplete)

  onCompleteRef.current = onComplete

  const clearTypingTimer = (): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const completeImmediately = (): void => {
    if (!isTyping) return
    sequenceRef.current += 1
    clearTypingTimer()
    setDisplayedText(text)
    setIsTyping(false)
    onCompleteRef.current?.()
  }

  useEffect(() => {
    sequenceRef.current += 1
    const sequence = sequenceRef.current
    clearTypingTimer()
    const graphemes = segmentGraphemes(text)
    setDisplayedText('')
    setIsTyping(graphemes.length > 0)

    if (graphemes.length === 0) {
      onCompleteRef.current?.()
      return clearTypingTimer
    }

    let index = 0
    const typeNext = (): void => {
      timerRef.current = setTimeout(() => {
        if (sequence !== sequenceRef.current) return
        index += 1
        setDisplayedText(graphemes.slice(0, index).join(''))
        if (index >= graphemes.length) {
          timerRef.current = null
          setIsTyping(false)
          onCompleteRef.current?.()
          return
        }
        typeNext()
      }, characterDelay)
    }
    typeNext()

    return () => {
      sequenceRef.current += 1
      clearTypingTimer()
    }
  }, [characterDelay, text])

  useEffect(() => {
    if (!isTyping) return
    const skipOnKey = (): void => completeImmediately()
    window.addEventListener('keydown', skipOnKey)
    return () => window.removeEventListener('keydown', skipOnKey)
  }, [isTyping, text])

  return (
    <span
      className="typewriter-text"
      onClick={completeImmediately}
      aria-live="polite"
      aria-label={text}
    >
      <span aria-hidden="true">{displayedText}</span>
      {isTyping && <span className="typewriter-cursor" aria-hidden="true">▍</span>}
    </span>
  )
}

export default TypewriterText
