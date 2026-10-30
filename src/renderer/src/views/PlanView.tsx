// 노트 창의 계획 탭: 달력에서 날짜를 골라 그날 계획을 적고 햄이에게 보여줍니다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DailyPlanCommentResult } from '../../../shared/types/plan'
import {
  buildCalendarDays,
  fromDateKey,
  toDateKey,
  type CalendarDay
} from '../dateKey'
import {
  autoSaveStatusLabel,
  useAutoSavedText
} from '../hooks/useAutoSavedText'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

interface Props {
  date: string
  onDateChange: (date: string) => void
}

type CommentState = 'idle' | 'requesting' | DailyPlanCommentResult['status']

const savePlan = async (date: string, text: string): Promise<void> => {
  await window.desktopPetAPI.saveDailyPlan({ date, text })
}

const commentStateLabel = (state: CommentState, truncated: boolean): string => {
  if (state === 'requesting') return '햄이가 읽는 중…'
  if (state === 'ok') return truncated ? '햄이가 말해줬어! (앞부분만 읽었어)' : '햄이가 말해줬어!'
  if (state === 'limited') return '햄이가 지금은 더 읽기 어렵대.'
  if (state === 'not-configured') return 'AI 대화 서버가 아직 연결되지 않았어.'
  if (state === 'error') return '햄이가 계획을 읽지 못했어.'
  if (state === 'empty') return '먼저 계획을 적어줘!'
  return ''
}

const monthOf = (dateKey: string): Date => {
  const date = fromDateKey(dateKey)
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function PlanView({ date, onDateChange }: Props): React.JSX.Element {
  const today = toDateKey(new Date())
  const [displayMonth, setDisplayMonth] = useState(() => monthOf(date))
  const [planDates, setPlanDates] = useState<Set<string>>(new Set())
  const [lastReply, setLastReply] = useState('')
  const [commentState, setCommentState] = useState<CommentState>('idle')
  const [truncated, setTruncated] = useState(false)
  const dateRef = useRef(date)
  dateRef.current = date

  const loadPlan = useCallback(async (targetDate: string): Promise<string> => {
    const plan = await window.desktopPetAPI.getDailyPlan(targetDate)
    if (dateRef.current === targetDate) setLastReply(plan?.hamsterReply ?? '')
    return plan?.text ?? ''
  }, [])

  const { text, setText, status, flush } = useAutoSavedText({
    date,
    load: loadPlan,
    save: savePlan
  })

  useEffect(() => {
    setDisplayMonth(monthOf(date))
    setCommentState('idle')
  }, [date])

  useEffect(() => {
    let active = true
    void window.desktopPetAPI
      .listDailyPlanDates()
      .then((dates) => active && setPlanDates(new Set(dates)))
      .catch(() => undefined)
    const unsubscribe = window.desktopPetAPI.onDailyPlanChanged(
      (dates) => setPlanDates(new Set(dates))
    )
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const calendarDays = useMemo(
    () => buildCalendarDays(displayMonth.getFullYear(), displayMonth.getMonth()),
    [displayMonth]
  )

  const moveMonth = (offset: number): void => {
    setDisplayMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1)
    )
  }

  const showToHami = async (): Promise<void> => {
    if (commentState === 'requesting') return
    const requestDate = date
    await flush()
    setCommentState('requesting')
    try {
      const result = await window.desktopPetAPI.commentOnDailyPlan(requestDate)
      if (dateRef.current !== requestDate) return
      setCommentState(result.status)
      setTruncated(result.truncated)
      if (result.status === 'ok' && result.plan?.hamsterReply) {
        setLastReply(result.plan.hamsterReply)
      }
    } catch {
      if (dateRef.current === requestDate) setCommentState('error')
    }
  }

  const dayClassName = (day: CalendarDay): string =>
    [
      'plan-day',
      day.inCurrentMonth ? '' : 'is-outside',
      day.key === today ? 'is-today' : '',
      day.key === date ? 'is-selected' : '',
      day.date.getDay() === 0 ? 'is-sunday' : '',
      day.date.getDay() === 6 ? 'is-saturday' : ''
    ]
      .filter(Boolean)
      .join(' ')

  const canShow =
    text.trim().length > 0 &&
    commentState !== 'requesting' &&
    status !== 'loading' &&
    status !== 'load-error'

  return (
    <div className="plan-body">
      <div className="plan-side">
        <section className="plan-calendar" aria-labelledby="plan-month">
          <div className="plan-calendar-toolbar">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달">◀</button>
            <h2 id="plan-month">
              {displayMonth.getFullYear()}년 {displayMonth.getMonth() + 1}월
            </h2>
            <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달">▶</button>
          </div>
          <div className="plan-weekdays" aria-hidden="true">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div className="plan-days">
            {calendarDays.map((day) => (
              <button
                key={day.key}
                type="button"
                className={dayClassName(day)}
                aria-pressed={day.key === date}
                aria-label={`${day.date.toLocaleDateString('ko-KR')} 계획${
                  planDates.has(day.key) ? ' (작성함)' : ''
                }`}
                onClick={() => onDateChange(day.key)}
              >
                {day.date.getDate()}
                {planDates.has(day.key) && <span className="plan-day-mark" aria-hidden="true" />}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="plan-today"
            disabled={date === today}
            onClick={() => onDateChange(today)}
          >
            오늘로
          </button>
        </section>

        <section className="plan-comment" aria-label="햄이에게 계획 보여주기">
          <button
            type="button"
            className="plan-comment-button"
            disabled={!canShow}
            onClick={() => void showToHami()}
          >
            {lastReply ? '햄이에게 다시 보여주기' : '햄이에게 보여주기'}
          </button>
          <p className="plan-comment-status" role="status">
            {commentStateLabel(commentState, truncated)}
          </p>
          {lastReply && (
            <details className="plan-last-reply">
              <summary>햄이의 지난 한마디</summary>
              <p>{lastReply}</p>
            </details>
          )}
        </section>
      </div>

      <section className="plan-page" aria-labelledby="plan-page-title">
        <h2 id="plan-page-title">
          {fromDateKey(date).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
          })}
        </h2>
        <textarea
          aria-labelledby="plan-page-title"
          value={text}
          disabled={status === 'loading' || status === 'load-error'}
          maxLength={20000}
          placeholder={'오늘은 어떤 하루를 보낼까?\n하고 싶은 일, 해야 할 일, 떠오르는 생각을 자유롭게 적어봐.'}
          onChange={(event) => setText(event.target.value)}
        />
        <footer className="plan-status" role="status">
          {autoSaveStatusLabel(status)}
        </footer>
      </section>
    </div>
  )
}

export default PlanView
