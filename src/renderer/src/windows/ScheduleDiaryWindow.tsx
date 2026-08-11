// 월간 달력과 선택 날짜 목록으로 일정을 생성·관리하는 다이어리 창입니다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Schedule } from '../../../shared/types/schedule'
import type { Holiday } from '../../../shared/types/holiday'
import ScheduleForm from '../components/ScheduleForm'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const VISIBLE_SCHEDULE_LIMIT = 2

interface CalendarDay {
  date: Date
  key: string
  inCurrentMonth: boolean
}

type EditingState =
  | { type: 'new'; date: string }
  | { type: 'edit'; schedule: Schedule }
  | null

const pad = (value: number): string => String(value).padStart(2, '0')

const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const fromDateKey = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const buildCalendarDays = (year: number, month: number): CalendarDay[] => {
  const firstDay = new Date(year, month, 1)
  const calendarStart = new Date(year, month, 1 - firstDay.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      calendarStart.getFullYear(),
      calendarStart.getMonth(),
      calendarStart.getDate() + index
    )
    return {
      date,
      key: toDateKey(date),
      inCurrentMonth: date.getFullYear() === year && date.getMonth() === month
    }
  })
}

const timeLabel = (schedule: Schedule): string =>
  new Date(schedule.startAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

function ScheduleDiaryWindow(): React.JSX.Element {
  const today = useMemo(() => new Date(), [])
  const todayKey = toDateKey(today)
  const [displayMonth, setDisplayMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  )
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [editing, setEditing] = useState<EditingState>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const dirtyRef = useRef(false)
  const editingRef = useRef<EditingState>(null)

  useEffect(() => {
    editingRef.current = editing
  }, [editing])

  const openNewForm = useCallback((requestedDate?: string): void => {
    if (
      editingRef.current !== null &&
      dirtyRef.current &&
      !window.confirm('작성 중인 내용을 버리고 새 일정을 작성할까요?')
    ) {
      return
    }
    const date = requestedDate ?? toDateKey(new Date())
    const parsedDate = fromDateKey(date)
    dirtyRef.current = false
    setSelectedDate(date)
    setIsDetailOpen(true)
    setDisplayMonth(
      new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1)
    )
    setEditing({ type: 'new', date })
  }, [])

  useEffect(() => {
    let active = true
    void window.desktopPetAPI
      .listSchedules()
      .then((items) => {
        if (active) {
          setSchedules(items)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setError('일정 목록을 불러오지 못했습니다.')
          setLoading(false)
        }
      })
    const unsubscribe =
      window.desktopPetAPI.onScheduleOpenNewRequested(openNewForm)
    const unsubscribeSchedulesChanged =
      window.desktopPetAPI.onSchedulesChanged((items) => {
        console.log('[schedule:ui] applying changed schedules', {
          count: items.length
        })
        setSchedules(items)
      })
    window.desktopPetAPI.notifyScheduleDiaryReady()
    return () => {
      active = false
      unsubscribe()
      unsubscribeSchedulesChanged()
    }
  }, [openNewForm])

  const schedulesByDate = useMemo(() => {
    const grouped = new Map<string, Schedule[]>()
    for (const schedule of schedules) {
      const key = toDateKey(new Date(schedule.startAt))
      const items = grouped.get(key) ?? []
      items.push(schedule)
      grouped.set(key, items)
    }
    for (const items of grouped.values()) {
      items.sort((left, right) => left.startAt.localeCompare(right.startAt))
    }
    return grouped
  }, [schedules])

  const calendarDays = useMemo(
    () =>
      buildCalendarDays(
        displayMonth.getFullYear(),
        displayMonth.getMonth()
      ),
    [displayMonth]
  )
  const visibleYears = useMemo(
    () => [...new Set(calendarDays.map((day) => day.date.getFullYear()))],
    [calendarDays]
  )
  const holidayByDate = useMemo(() => {
    const grouped = new Map<string, string[]>()
    for (const holiday of holidays) {
      const names = grouped.get(holiday.date) ?? []
      names.push(holiday.name)
      grouped.set(holiday.date, names)
    }
    return grouped
  }, [holidays])
  const selectedSchedules = schedulesByDate.get(selectedDate) ?? []

  useEffect(() => {
    let active = true
    void window.desktopPetAPI
      .listHolidays(visibleYears)
      .then((items) => {
        if (active) setHolidays(items)
      })
      .catch((holidayError: unknown) => {
        console.warn('[holiday:ui] failed to load holidays', holidayError)
        if (active) setHolidays([])
      })
    return () => {
      active = false
    }
  }, [visibleYears])

  const selectDay = (day: CalendarDay): void => {
    setSelectedDate(day.key)
    setIsDetailOpen(true)
    if (!day.inCurrentMonth) {
      setDisplayMonth(
        new Date(day.date.getFullYear(), day.date.getMonth(), 1)
      )
    }
  }

  const moveMonth = (offset: number): void => {
    setDisplayMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1)
    )
  }

  const goToday = (): void => {
    const now = new Date()
    const key = toDateKey(now)
    setDisplayMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDate(key)
  }

  const removeSchedule = async (schedule: Schedule): Promise<void> => {
    if (
      !window.confirm(
        `“${schedule.title}” 일정을 삭제할까요?\n삭제한 일정은 복구할 수 없습니다.`
      )
    ) {
      return
    }
    try {
      setSchedules(await window.desktopPetAPI.deleteSchedule(schedule.id))
    } catch {
      setError('일정을 삭제하지 못했습니다.')
    }
  }

  const toggleCompleted = async (schedule: Schedule): Promise<void> => {
    try {
      setSchedules(
        await window.desktopPetAPI.setScheduleCompleted({
          id: schedule.id,
          completed: schedule.status !== 'completed'
        })
      )
    } catch {
      setError('완료 상태를 변경하지 못했습니다.')
    }
  }

  const openEditForm = (schedule: Schedule): void => {
    setSelectedDate(toDateKey(new Date(schedule.startAt)))
    setEditing({ type: 'edit', schedule })
  }

  return (
    <main className="schedule-diary">
      <header className="schedule-header">
        <div>
          <p className="schedule-eyebrow">Desktop Pet Scheduler</p>
          <h1>일정 다이어리</h1>
        </div>
        <div className="schedule-header-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => void window.desktopPetAPI.openHelp()}
          >
            ? 도움말
          </button>
          <button type="button" onClick={() => openNewForm(selectedDate)}>
            + 새 일정 추가
          </button>
        </div>
      </header>

      {error && (
        <p className="schedule-error" role="alert">
          {error}
        </p>
      )}

      <div
        className={`calendar-workspace ${
          isDetailOpen ? 'is-detail-open' : ''
        }`}
      >
        <section className="calendar-panel" aria-labelledby="calendar-month">
        <div className="calendar-toolbar">
          <div className="calendar-navigation">
            <button
              type="button"
              className="secondary"
              aria-label="이전 달"
              onClick={() => moveMonth(-1)}
            >
              ‹
            </button>
            <button type="button" className="secondary" onClick={goToday}>
              오늘
            </button>
            <button
              type="button"
              className="secondary"
              aria-label="다음 달"
              onClick={() => moveMonth(1)}
            >
              ›
            </button>
          </div>
          <h2 id="calendar-month">
            {displayMonth.toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long'
            })}
          </h2>
        </div>

        <div className="calendar-weekdays" aria-hidden="true">
          {WEEKDAYS.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>

        {loading ? (
          <p className="calendar-loading">일정을 불러오는 중입니다.</p>
        ) : (
          <div className="calendar-grid">
            {calendarDays.map((day) => {
              const daySchedules = schedulesByDate.get(day.key) ?? []
              const dayHolidays = holidayByDate.get(day.key) ?? []
              const hiddenCount =
                daySchedules.length - VISIBLE_SCHEDULE_LIMIT
              return (
                <div
                  key={day.key}
                  className={[
                    'calendar-day',
                    day.inCurrentMonth ? '' : 'is-outside',
                    day.key === todayKey ? 'is-today' : '',
                    day.key === selectedDate ? 'is-selected' : '',
                    dayHolidays.length > 0 ? 'is-holiday' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={`${day.date.toLocaleDateString('ko-KR')}${
                    dayHolidays.length > 0 ? ` ${dayHolidays.join(', ')}` : ''
                  } 일정 보기`}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectDay(day)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      selectDay(day)
                    }
                  }}
                >
                  <span className="calendar-day-number">
                    {day.date.getDate()}
                  </span>
                  {dayHolidays.length > 0 && (
                    <span
                      className="calendar-holiday"
                      title={dayHolidays.join(', ')}
                    >
                      {dayHolidays.join(' · ')}
                    </span>
                  )}
                  <span className="calendar-day-schedules">
                    {daySchedules
                      .slice(0, VISIBLE_SCHEDULE_LIMIT)
                      .map((schedule) => (
                        <button
                          key={schedule.id}
                          type="button"
                          className={`calendar-schedule ${
                            schedule.status === 'completed'
                              ? 'is-completed'
                              : ''
                          }`}
                          onClick={(event) => {
                            event.stopPropagation()
                            setIsDetailOpen(true)
                            openEditForm(schedule)
                          }}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <span>{timeLabel(schedule)}</span>
                          <span>{schedule.title}</span>
                        </button>
                      ))}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        className="calendar-more"
                        aria-label={`숨겨진 일정 ${hiddenCount}개 보기`}
                        title={`일정 ${hiddenCount}개 더 보기`}
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedDate(day.key)
                          setIsDetailOpen(true)
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        +{hiddenCount}
                      </button>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        </section>

      <section
        className="selected-date-panel"
        aria-labelledby="selected-date-title"
        aria-hidden={!isDetailOpen}
        inert={!isDetailOpen}
      >
        <div className="selected-date-header">
          <div>
            <p>선택한 날짜</p>
            <h2 id="selected-date-title">
              {fromDateKey(selectedDate).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
              })}
            </h2>
          </div>
          <button
            type="button"
            className="detail-close-button"
            aria-label="상세 패널 닫기"
            onClick={() => setIsDetailOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="selected-date-content">
          {selectedSchedules.length === 0 ? (
            <p className="selected-date-empty">
              이 날짜에는 아직 일정이 없습니다.
            </p>
          ) : (
            <ul className="selected-schedule-list">
              {selectedSchedules.map((schedule) => (
                <li
                  key={schedule.id}
                  className={
                    schedule.status === 'completed' ? 'is-completed' : ''
                  }
                >
                  <label className="schedule-complete">
                    <input
                      type="checkbox"
                      checked={schedule.status === 'completed'}
                      onChange={() => void toggleCompleted(schedule)}
                    />
                    <span className="sr-only">완료 상태</span>
                  </label>
                  <time dateTime={schedule.startAt}>{timeLabel(schedule)}</time>
                  <strong>{schedule.title}</strong>
                  <span className="schedule-state">
                    {schedule.status === 'completed' ? '완료' : '예정'}
                  </span>
                  <div className="schedule-actions">
                    <button type="button" onClick={() => openEditForm(schedule)}>
                      수정
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => void removeSchedule(schedule)}
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          className="detail-add-button"
          onClick={() => openNewForm(selectedDate)}
        >
          + 일정 추가
        </button>
      </section>
      </div>

      {editing !== null && (
        <div className="schedule-modal-backdrop" role="presentation">
          <ScheduleForm
            schedule={editing.type === 'edit' ? editing.schedule : null}
            initialDate={
              editing.type === 'new' ? editing.date : undefined
            }
            onDirtyChange={(dirty) => {
              dirtyRef.current = dirty
            }}
            onCancel={() => {
              dirtyRef.current = false
              setEditing(null)
            }}
            onSaved={(items) => {
              setSchedules(items)
              dirtyRef.current = false
              setEditing(null)
            }}
          />
        </div>
      )}
    </main>
  )
}

export default ScheduleDiaryWindow
