import { useEffect, useRef, useState } from 'react'
import type { ChatTurn } from '../../../shared/types/chat'
import type { PetScheduleInputPlacement } from '../../../shared/types/pet'
import type { Schedule } from '../../../shared/types/schedule'
import type { ParsedSchedule } from '../scheduleParser'
import {
  describeSchedules,
  detectScheduleIntent,
  findScheduleTargets,
  scheduleDateTime,
  scheduleWhenLabel,
  schedulesInRange,
  whenLabel,
  type ScheduleIntent
} from '../scheduleChat'
import { splitSpeechPages } from '../speechPages'
import { SpeechBubbleFrame } from './SpeechBubble'
import TypewriterText from './TypewriterText'

interface PetScheduleInputProps {
  side: PetScheduleInputPlacement['side']
  onClose: () => void
}

// A schedule change waiting for the user's OK on the confirmation card.
type PendingAction =
  | { kind: 'add'; items: ParsedSchedule[]; message: string }
  | { kind: 'move'; schedule: Schedule; date: string; time: string }
  | { kind: 'delete'; schedule: Schedule }
  | {
      kind: 'choose'
      intent: 'move' | 'delete'
      candidates: Schedule[]
      date?: string
      time?: string
    }

const FALLBACK_MESSAGE = '지금은 대답하기가 조금 어려워. 잠시 후에 다시 말 걸어줘! 🐹'
const DEFAULT_REMINDER_MINUTES = 10
const MAX_CANDIDATES = 3
// Show how many chats are left once today's count is this low.
const LOW_USAGE_HINT_AT = 5

const errorText = (error: unknown): string =>
  error instanceof Error && error.message
    ? error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/u, '')
    : '일정을 저장하지 못했어. 다시 해볼래?'

function PetScheduleInput({ side, onClose }: PetScheduleInputProps): React.JSX.Element {
  const [text, setText] = useState('')
  const [reply, setReply] = useState('무슨 얘기 하고 싶어? 일정도 말로 넣을 수 있어! 🐹')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageTyped, setPageTyped] = useState(false)
  const [history, setHistory] = useState<ChatTurn[]>([])
  const [pending, setPending] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [showCalendarLink, setShowCalendarLink] = useState(false)
  const [usageHint, setUsageHint] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const pages = splitSpeechPages(reply)
  const hasNextPage = pageIndex < pages.length - 1

  const say = (next: string): void => {
    setReply(next)
    setPageIndex(0)
    setPageTyped(false)
  }

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

  const askHami = async (message: string): Promise<void> => {
    setPending(true)
    try {
      const result = await window.desktopPetAPI.converseWithHami({
        message,
        history: history.slice(-5)
      })
      say(result.reply)
      const left = result.remainingDailyUsage
      setUsageHint(
        !result.limited && left !== undefined && left <= LOW_USAGE_HINT_AT
          ? left === 0
            ? '오늘 AI 대화는 이게 마지막이었어. 일정 말은 계속 할 수 있어!'
            : `오늘 AI 대화 ${left}번 더 할 수 있어.`
          : ''
      )
      setHistory((current) => [
        ...current,
        { role: 'user', content: message } as const,
        { role: 'assistant', content: result.reply } as const
      ].slice(-5))
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : ''
      say(
        message.includes('HAMI_CHAT_NOT_CONFIGURED')
          ? 'AI 대화 서버가 아직 연결되지 않았어. 일정은 "내일 3시 병원"처럼 말해주면 넣어줄게! 🐹'
          : FALLBACK_MESSAGE
      )
    } finally {
      setPending(false)
    }
  }

  // Schedule sentences are handled here, on this computer, without calling the AI.
  const handleScheduleIntent = async (intent: ScheduleIntent, message: string): Promise<void> => {
    if (intent.kind === 'add') {
      setPendingAction({ kind: 'add', items: intent.items, message })
      say(intent.items.length > 1 ? `일정 ${intent.items.length}개 넣을까?` : '이렇게 넣을까?')
      return
    }

    setPending(true)
    try {
      const schedules = await window.desktopPetAPI.listSchedules()
      if (intent.kind === 'query') {
        const found = schedulesInRange(schedules, intent.from, intent.to)
        const { text: answer, hasMore } = describeSchedules(found, intent.label, intent.from !== intent.to)
        setShowCalendarLink(hasMore)
        say(answer)
        return
      }

      const candidates = findScheduleTargets(schedules, intent.target, new Date(), intent.kind === 'delete' ? intent.onDate : undefined)
      if (candidates.length === 0) {
        say(`'${intent.target}' 일정을 못 찾았어. 이름을 조금 다르게 말해줄래?`)
        return
      }
      const date = intent.kind === 'move' ? intent.date : undefined
      const time = intent.kind === 'move' ? intent.time : undefined
      if (candidates.length > 1) {
        setPendingAction({
          kind: 'choose',
          intent: intent.kind,
          candidates: candidates.slice(0, MAX_CANDIDATES),
          date,
          time
        })
        say(`'${intent.target}' 일정이 ${candidates.length}개 있어. 어떤 거야?`)
        return
      }
      chooseTarget(intent.kind, candidates[0], date, time)
    } catch (scheduleError) {
      say(errorText(scheduleError))
    } finally {
      setPending(false)
    }
  }

  const chooseTarget = (
    intent: 'move' | 'delete',
    schedule: Schedule,
    date?: string,
    time?: string
  ): void => {
    if (intent === 'delete') {
      setPendingAction({ kind: 'delete', schedule })
      say('이 일정을 지울까?')
      return
    }
    const current = scheduleDateTime(schedule)
    setPendingAction({ kind: 'move', schedule, date: date ?? current.date, time: time ?? current.time })
    say('이렇게 옮길까?')
  }

  const sendMessage = async (): Promise<void> => {
    const message = text.trim()
    if (!message || pending) {
      if (!message) setError('햄이에게 할 말을 입력해줘.')
      return
    }
    setError('')
    setText('')
    setPendingAction(null)
    setShowCalendarLink(false)
    setUsageHint('')
    const intent = detectScheduleIntent(message)
    if (intent) await handleScheduleIntent(intent, message)
    else await askHami(message)
  }

  const confirmAction = async (): Promise<void> => {
    const action = pendingAction
    if (!action || action.kind === 'choose') return
    setPending(true)
    try {
      if (action.kind === 'add') {
        for (const item of action.items) {
          await window.desktopPetAPI.createSchedule({
            title: item.title,
            date: item.date,
            time: item.time,
            reminderMinutesBefore: DEFAULT_REMINDER_MINUTES,
            memo: ''
          })
        }
        const [first] = action.items
        say(
          action.items.length > 1
            ? `일정 ${action.items.length}개 넣어뒀어! 🐹`
            : `${whenLabel(first.date, first.time)}에 '${first.title}' 넣어뒀어! 🐹`
        )
      } else if (action.kind === 'move') {
        const { schedule } = action
        await window.desktopPetAPI.updateSchedule({
          id: schedule.id,
          draft: {
            title: schedule.title,
            date: action.date,
            time: action.time,
            reminderMinutesBefore: schedule.reminderMinutesBefore,
            memo: schedule.memo
          }
        })
        say(`'${schedule.title}' ${whenLabel(action.date, action.time)}로 옮겼어!`)
      } else {
        await window.desktopPetAPI.deleteSchedule(action.schedule.id)
        say(`'${action.schedule.title}' 일정 지웠어.`)
      }
      setPendingAction(null)
    } catch (scheduleError) {
      say(errorText(scheduleError))
    } finally {
      setPending(false)
    }
  }

  const cancelAction = (): void => {
    setPendingAction(null)
    say('알겠어, 그대로 둘게!')
  }

  // The sentence was misread as a schedule; send it to Hami as normal chat.
  const chatInstead = (message: string): void => {
    setPendingAction(null)
    void askHami(message)
  }

  const renderPendingAction = (): React.JSX.Element | null => {
    if (!pendingAction || pending) return null
    if (pendingAction.kind === 'choose') {
      return (
        <div className="pet-schedule-card">
          {pendingAction.candidates.map((schedule) => (
            <button
              key={schedule.id}
              type="button"
              className="pet-schedule-choice"
              onClick={() => chooseTarget(pendingAction.intent, schedule, pendingAction.date, pendingAction.time)}
            >
              📅 {scheduleWhenLabel(schedule)} {schedule.title}
            </button>
          ))}
          <div className="pet-schedule-card-actions">
            <button type="button" onClick={cancelAction}>취소</button>
          </div>
        </div>
      )
    }

    const lines =
      pendingAction.kind === 'add'
        ? pendingAction.items.map((item) => `📅 ${whenLabel(item.date, item.time)} ${item.title}`)
        : pendingAction.kind === 'move'
          ? [
              `📅 ${pendingAction.schedule.title}`,
              `${scheduleWhenLabel(pendingAction.schedule)} → ${whenLabel(pendingAction.date, pendingAction.time)}`
            ]
          : [`🗑 ${scheduleWhenLabel(pendingAction.schedule)} ${pendingAction.schedule.title}`]
    const confirmLabel =
      pendingAction.kind === 'add' ? '추가' : pendingAction.kind === 'move' ? '옮기기' : '지우기'
    return (
      <div className="pet-schedule-card">
        <ul>
          {lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <div className="pet-schedule-card-actions">
          <button type="button" className="confirm" onClick={() => void confirmAction()}>{confirmLabel}</button>
          <button type="button" onClick={cancelAction}>취소</button>
        </div>
        {pendingAction.kind === 'add' && (
          <button type="button" className="pet-schedule-chat-instead" onClick={() => chatInstead(pendingAction.message)}>
            일정 말고 그냥 대화할래
          </button>
        )}
      </div>
    )
  }

  return (
    <SpeechBubbleFrame className={`pet-inline-input is-${side}${pending ? ' is-pending' : ''}`} interactive>
      <div data-pet-schedule-input aria-label="햄이와 대화하기">
        <p className="pet-inline-reply" aria-live="polite">
          <TypewriterText
            key={`${reply}#${pageIndex}`}
            text={pending ? '잠깐만 기다려 봐…' : (pages[pageIndex] ?? '')}
            onComplete={() => setPageTyped(true)}
          />
          {!pending && hasNextPage && pageTyped && (
            <button
              type="button"
              className="pet-inline-next"
              aria-label="다음 말 보기"
              onClick={() => {
                setPageIndex((index) => index + 1)
                setPageTyped(false)
              }}
            >
              ▶
            </button>
          )}
        </p>
        {usageHint && !pending && <p className="pet-inline-usage">{usageHint}</p>}
        {renderPendingAction()}
        {showCalendarLink && !pending && (
          <button
            type="button"
            className="pet-schedule-chat-instead"
            onClick={() => void window.desktopPetAPI.openScheduleDiary().then(onClose)}
          >
            달력에서 전체 보기
          </button>
        )}
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
            placeholder="예: 내일 3시 병원, 오늘 뭐 있어?"
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
        <p className="pet-inline-privacy">일정 말은 이 컴퓨터에서만 처리돼. 그 밖의 대화와 최근 대화 일부만 AI로 전송돼.</p>
        <button type="button" className="close" aria-label="대화 닫기" onClick={onClose}>×</button>
        {error && <p className="pet-inline-error" role="alert">{error}</p>}
      </div>
    </SpeechBubbleFrame>
  )
}

export default PetScheduleInput
