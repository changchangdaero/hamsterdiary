import { useEffect, useRef, useState } from 'react'
import type { ChatTurn } from '../../../shared/types/chat'
import type { PetScheduleInputPlacement } from '../../../shared/types/pet'
import { SpeechBubbleFrame } from './SpeechBubble'
import TypewriterText from './TypewriterText'

interface PetScheduleInputProps {
  side: PetScheduleInputPlacement['side']
  onClose: () => void
}

const FALLBACK_MESSAGE = '지금은 대답하기가 조금 어려워. 잠시 후에 다시 말 걸어줘! 🐹'

function PetScheduleInput({ side, onClose }: PetScheduleInputProps): React.JSX.Element {
  const [text, setText] = useState('')
  const [reply, setReply] = useState('무슨 얘기 하고 싶어? 🐹')
  const [history, setHistory] = useState<ChatTurn[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (pending) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [pending, reply])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const sendMessage = async (): Promise<void> => {
    const message = text.trim()
    if (!message || pending) {
      if (!message) setError('햄이에게 할 말을 입력해줘.')
      return
    }
    setPending(true)
    setError('')
    setText('')
    try {
      const result = await window.desktopPetAPI.converseWithHami({
        message,
        history: history.slice(-5)
      })
      setReply(result.reply)
      setHistory((current) => [
        ...current,
        { role: 'user', content: message } as const,
        { role: 'assistant', content: result.reply } as const
      ].slice(-5))
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : ''
      setReply(
        message.includes('HAMI_CHAT_NOT_CONFIGURED')
          ? 'AI 대화 서버가 아직 연결되지 않았어. 일정이나 할 일은 직접 추가할 수 있어! 🐹'
          : FALLBACK_MESSAGE
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <SpeechBubbleFrame className={`pet-inline-input is-${side}${pending ? ' is-pending' : ''}`} interactive>
      <div data-pet-schedule-input aria-label="햄이와 대화하기">
        <p className="pet-inline-reply" aria-live="polite">
          <TypewriterText text={pending ? '잠깐만 기다려 봐…' : reply} />
        </p>
        <div className="pet-input-mode" aria-label="로컬 기능 바로가기">
          <button type="button" disabled={pending} onClick={() => void window.desktopPetAPI.openNewSchedule().then(onClose)}>
            일정 추가
          </button>
          <button type="button" disabled={pending} onClick={() => void window.desktopPetAPI.openTodos().then(onClose)}>
            할 일 열기
          </button>
        </div>
        <div className="pet-inline-query">
          <textarea
            ref={inputRef}
            value={text}
            maxLength={1_000}
            rows={1}
            autoFocus
            disabled={pending}
            placeholder="햄이한테 말해봐…"
            aria-label="햄이에게 할 말"
            onChange={(event) => {
              setText(event.target.value)
              setError('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void sendMessage()
              }
            }}
          />
          <button type="button" className="confirm" aria-label="메시지 보내기" disabled={pending || text.trim().length === 0} onClick={() => void sendMessage()}>
            보내기
          </button>
        </div>
        <p className="pet-inline-privacy">이 대화와 최근 대화 일부만 AI로 전송돼. 일정과 일기는 전송되지 않아.</p>
        <button type="button" className="close" aria-label="대화 닫기" onClick={onClose}>×</button>
        {error && <p className="pet-inline-error" role="alert">{error}</p>}
      </div>
    </SpeechBubbleFrame>
  )
}

export default PetScheduleInput
