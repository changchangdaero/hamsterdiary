import { useEffect, useRef, useState } from 'react'
import type { PetScheduleInputPlacement } from '../../../shared/types/pet'
import type { ScheduleConversationTurn } from '../../../shared/types/scheduleConversation'
import { SpeechBubbleFrame } from './SpeechBubble'

interface PetScheduleInputProps {
  side: PetScheduleInputPlacement['side']
  onClose: () => void
}

const FALLBACK_MESSAGE = '지금 대화가 잘 안 돼, 직접 입력해줄래?'
const MISSING_KEY_MESSAGE = '먼저 설정에서 Gemini API 키를 입력해줘.'
const INVALID_KEY_MESSAGE = 'API 키가 올바르지 않은 것 같아. 설정에서 다시 확인해줘.'

function PetScheduleInput({
  side,
  onClose
}: PetScheduleInputProps): React.JSX.Element {
  const [mode, setMode] = useState<'schedule' | 'todo'>('schedule')
  const [text, setText] = useState('')
  const [reply, setReply] = useState('어떤 일정을 알아볼까?')
  const [history, setHistory] = useState<ScheduleConversationTurn[]>([])
  const [pending, setPending] = useState(false)
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState('')
  const [keyError, setKeyError] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current)
    }
  }, [onClose])

  const openManualForm = async (): Promise<void> => {
    try {
      if (mode === 'schedule') await window.desktopPetAPI.openNewSchedule()
      else await window.desktopPetAPI.openTodos()
      onClose()
    } catch {
      setError('수동 입력 화면도 열지 못했어. 잠시 후 다시 시도해줘.')
    }
  }

  const sendMessage = async (): Promise<void> => {
    const message = text.trim()
    if (!message || pending || finished) {
      if (!message && !finished) setError('햄스터에게 할 말을 입력해줘.')
      return
    }

    setPending(true)
    setError('')
    setKeyError(false)
    setText('')
    try {
      const request = { message, history }
      const result =
        mode === 'schedule'
          ? await window.desktopPetAPI.converseAboutSchedule(request)
          : await window.desktopPetAPI.converseAboutTodo(request)
      setReply(result.reply)
      setHistory((current) => [
        ...current,
        { role: 'user', text: message },
        {
          role: 'assistant',
          text: mode === 'schedule' ? JSON.stringify(result) : result.reply
        }
      ])

      const isFinished =
        'phase' in result
          ? result.phase === 'completed' || result.phase === 'cancelled'
          : result.completed
      if (isFinished) {
        setFinished(true)
        setPending(false)
        closeTimerRef.current = setTimeout(onClose, 5_000)
        return
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : String(requestError)
      if (message.includes('GEMINI_KEY_MISSING')) {
        setReply(MISSING_KEY_MESSAGE)
        setKeyError(true)
      } else if (message.includes('GEMINI_KEY_INVALID')) {
        setReply(INVALID_KEY_MESSAGE)
        setKeyError(true)
      } else {
        setReply(FALLBACK_MESSAGE)
      }
      setError('')
    }
    setPending(false)
  }

  return (
    <SpeechBubbleFrame
      className={`pet-inline-input is-${side}${pending ? ' is-pending' : ''}`}
      interactive
    >
      <div data-pet-schedule-input aria-label="햄스터와 대화로 일정 잡기">
        <p className="pet-inline-reply" aria-live="polite">
          {pending ? '생각 중이야…' : reply}
        </p>
        {!finished && (
          <>
          <fieldset className="pet-input-mode" aria-label="대화 입력 목적지">
            <label>
              <input
                type="radio"
                name="pet-input-mode"
                disabled={pending}
                checked={mode === 'schedule'}
                onChange={() => {
                  setMode('schedule')
                  setHistory([])
                  setReply('어떤 일정을 알아볼까?')
                  setError('')
                }}
              />
              <span>일정</span>
              <span className="mode-tooltip" role="tooltip">
                시간이 정해진 일이야 📅 (예: 내일 3시 병원, 금요일 저녁 회식)
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="pet-input-mode"
                disabled={pending}
                checked={mode === 'todo'}
                onChange={() => {
                  setMode('todo')
                  setHistory([])
                  setReply('어떤 할 일을 같이 해볼까?')
                  setError('')
                }}
              />
              <span>할일</span>
              <span className="mode-tooltip" role="tooltip">
                언젠가 해야 할 계획이야 ✅ (예: 우유 사기, 리포트 제출)
              </span>
            </label>
          </fieldset>
          <div className="pet-inline-query">
            <textarea
              value={text}
              maxLength={500}
              rows={1}
              autoFocus
              disabled={pending}
              placeholder="햄스터한테 말해봐…"
              aria-label="햄스터에게 할 말"
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
            <button
              type="button"
              className="confirm"
              aria-label="메시지 보내기"
              disabled={pending || text.trim().length === 0}
              onClick={() => void sendMessage()}
            >
              보내기
            </button>
          </div>
          </>
        )}
        {reply === FALLBACK_MESSAGE && (
          <button
            type="button"
            className="manual"
            onClick={() => void openManualForm()}
          >
            직접 입력
          </button>
        )}
        {keyError && (
          <button
            type="button"
            className="manual"
            onClick={() => {
              void window.desktopPetAPI.openSettings()
              onClose()
            }}
          >
            설정 열기
          </button>
        )}
        <button
          type="button"
          className="close"
          aria-label="대화 닫기"
          onClick={onClose}
        >
          ×
        </button>
        {error && (
          <p className="pet-inline-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </SpeechBubbleFrame>
  )
}

export default PetScheduleInput
