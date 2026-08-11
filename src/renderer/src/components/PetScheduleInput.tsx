import { useEffect, useState } from 'react'
import type { PetScheduleInputPlacement } from '../../../shared/types/pet'
import type { ScheduleConversationTurn } from '../../../shared/types/scheduleConversation'

interface PetScheduleInputProps {
  side: PetScheduleInputPlacement['side']
  onClose: () => void
}

const FALLBACK_MESSAGE = '지금 대화가 잘 안 돼, 직접 입력해줄래?'

function PetScheduleInput({
  side,
  onClose
}: PetScheduleInputProps): React.JSX.Element {
  const [text, setText] = useState('')
  const [reply, setReply] = useState('어떤 일정을 잡아볼까?')
  const [history, setHistory] = useState<ScheduleConversationTurn[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const fallBackToManualForm = async (date?: string | null): Promise<void> => {
    await window.desktopPetAPI.showPetMessage({
      text: FALLBACK_MESSAGE,
      finalEmotion: 'sad',
      visibleDuration: 6_000
    })
    await window.desktopPetAPI.openNewSchedule(date ?? undefined)
    onClose()
  }

  const sendMessage = async (): Promise<void> => {
    const message = text.trim()
    if (!message || pending) {
      if (!message) setError('햄스터에게 할 말을 입력해줘.')
      return
    }

    setPending(true)
    setError('')
    setText('')
    try {
      const result = await window.desktopPetAPI.converseAboutSchedule({
        message,
        history
      })
      setReply(result.reply)
      setHistory((current) => [
        ...current,
        { role: 'user', text: message },
        { role: 'assistant', text: JSON.stringify(result) }
      ])

      if (result.phase === 'completed') {
        await window.desktopPetAPI.showPetMessage({
          text: result.reply,
          finalEmotion: 'happy',
          visibleDuration: 5_000
        })
        onClose()
        return
      }
      if (result.phase === 'cancelled') {
        await window.desktopPetAPI.showPetMessage({
          text: result.reply,
          finalEmotion: 'idle',
          visibleDuration: 4_000
        })
        onClose()
        return
      }
    } catch {
      try {
        await fallBackToManualForm()
      } catch {
        setReply(FALLBACK_MESSAGE)
        setError('수동 입력 폼도 열지 못했어. 잠시 후 다시 시도해줘.')
        setPending(false)
      }
      return
    }
    setPending(false)
  }

  return (
    <section
      className={`pet-inline-input is-${side}`}
      data-pet-schedule-input
      data-interactive-hitbox="true"
      aria-label="햄스터와 대화로 일정 잡기"
    >
      <p className="pet-inline-reply" aria-live="polite">
        {pending ? '생각 중이야…' : reply}
      </p>
      <div className="pet-inline-query">
        <input
          value={text}
          maxLength={500}
          autoFocus
          disabled={pending}
          placeholder="내일 오후 3시 회의"
          aria-label="햄스터에게 할 말"
          onChange={(event) => {
            setText(event.target.value)
            setError('')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void sendMessage()
            }
          }}
        />
        <button
          type="button"
          className="confirm"
          disabled={pending}
          onClick={() => void sendMessage()}
        >
          {pending ? '…' : '보내기'}
        </button>
        <button type="button" className="close" aria-label="대화 닫기" onClick={onClose}>
          ×
        </button>
      </div>
      {error && <p className="pet-inline-error" role="alert">{error}</p>}
    </section>
  )
}

export default PetScheduleInput
