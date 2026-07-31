// 새 일정과 기존 일정 수정에 공용으로 사용하는 입력 폼입니다.
import { useEffect, useMemo, useState } from 'react'
import type {
  Schedule,
  ScheduleDraft,
  ScheduleReminderMinutes
} from '../../../shared/types/schedule'
import {
  parseSchedule,
  type ParsedSchedule
} from '../scheduleParser'

interface ScheduleFormProps {
  schedule: Schedule | null
  initialDate?: string
  onCancel: () => void
  onSaved: (schedules: Schedule[]) => void
  onDirtyChange: (dirty: boolean) => void
}

type FieldErrors = Partial<Record<keyof ScheduleDraft | 'form', string>>

const pad = (value: number): string => String(value).padStart(2, '0')

const dateAndTime = (date: Date): Pick<ScheduleDraft, 'date' | 'time'> => ({
  date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
  time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
})

const defaultDraft = (initialDate?: string): ScheduleDraft => {
  const next = new Date()
  next.setMinutes((Math.floor(next.getMinutes() / 30) + 1) * 30, 0, 0)
  const nextDateAndTime = dateAndTime(next)
  return {
    title: '',
    ...nextDateAndTime,
    date: initialDate ?? nextDateAndTime.date,
    reminderMinutesBefore: 10,
    memo: ''
  }
}

const draftFromSchedule = (schedule: Schedule): ScheduleDraft => ({
  title: schedule.title,
  ...dateAndTime(new Date(schedule.startAt)),
  reminderMinutesBefore: schedule.reminderMinutesBefore,
  memo: schedule.memo
})

const validate = (draft: ScheduleDraft): FieldErrors => {
  const errors: FieldErrors = {}
  const title = draft.title.trim()
  if (!title) {
    errors.title = '제목을 입력해 주세요.'
  } else if (title.length > 80) {
    errors.title = '제목은 80자 이하로 입력해 주세요.'
  }
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(draft.date)
  if (!dateMatch) {
    errors.date = '날짜를 선택해 주세요.'
  } else {
    const year = Number(dateMatch[1])
    const month = Number(dateMatch[2])
    const day = Number(dateMatch[3])
    const parsed = new Date(year, month - 1, day)
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      errors.date = '실제로 존재하는 날짜를 선택해 주세요.'
    }
  }
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(draft.time)
  if (
    !timeMatch ||
    Number(timeMatch[1]) > 23 ||
    Number(timeMatch[2]) > 59
  ) {
    errors.time = '시간을 선택해 주세요.'
  }
  if (draft.memo.length > 500) {
    errors.memo = '메모는 500자 이하로 입력해 주세요.'
  }
  return errors
}

function ScheduleForm({
  schedule,
  initialDate,
  onCancel,
  onSaved,
  onDirtyChange
}: ScheduleFormProps): React.JSX.Element {
  const initialDraft = useMemo(
    () =>
      schedule ? draftFromSchedule(schedule) : defaultDraft(initialDate),
    [initialDate, schedule]
  )
  const [draft, setDraft] = useState(initialDraft)
  const [naturalText, setNaturalText] = useState('')
  const [parsePreview, setParsePreview] = useState<ParsedSchedule | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(initialDraft) ||
    naturalText.trim().length > 0
  const selectedDate = new Date(`${draft.date}T${draft.time}:00`)
  const isPast =
    !Number.isNaN(selectedDate.getTime()) && selectedDate.getTime() < Date.now()

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const updateField = <K extends keyof ScheduleDraft>(
    field: K,
    value: ScheduleDraft[K]
  ): void => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }))
  }

  const parseNaturalText = (): void => {
    const text = naturalText.trim()
    if (!text) {
      setParsePreview(null)
      setErrors((current) => ({
        ...current,
        form: '자연어로 입력할 문장을 적어주세요.'
      }))
      return
    }

    const parsed = parseSchedule(text)
    setParsePreview(parsed)
    setDraft((current) => ({
      ...current,
      date: parsed.date,
      time: parsed.time,
      title: parsed.title
    }))
    setErrors((current) => ({
      ...current,
      title: undefined,
      date: undefined,
      time: undefined,
      form: undefined
    }))
  }

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (saving) {
      return
    }
    const nextErrors = validate(draft)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    setErrors({})
    try {
      const normalized = { ...draft, title: draft.title.trim() }
      const schedules = schedule
        ? await window.desktopPetAPI.updateSchedule({
            id: schedule.id,
            draft: normalized
          })
        : await window.desktopPetAPI.createSchedule(normalized)
      onSaved(schedules)
    } catch {
      setErrors({ form: '일정을 저장하지 못했습니다. 입력값을 확인해 주세요.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="schedule-form-panel" aria-labelledby="schedule-form-title">
      <h2 id="schedule-form-title">
        {schedule ? '일정 수정' : '새 일정 추가'}
      </h2>
      <form onSubmit={(event) => void submit(event)} noValidate>
        {schedule === null && (
          <section
            className="natural-schedule-input"
            aria-labelledby="natural-schedule-title"
          >
            <div>
              <h3 id="natural-schedule-title">문장으로 빠르게 입력</h3>
              <p>날짜와 시간을 확인한 뒤 기존 저장 버튼을 눌러주세요.</p>
            </div>
            <div className="natural-schedule-controls">
              <input
                id="natural-schedule-text"
                value={naturalText}
                maxLength={200}
                autoFocus
                placeholder="내일 오후 3시 회의"
                aria-label="자연어 일정"
                onChange={(event) => {
                  setNaturalText(event.target.value)
                  setParsePreview(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    parseNaturalText()
                  }
                }}
              />
              <button type="button" onClick={parseNaturalText}>
                미리보기
              </button>
            </div>

            {parsePreview && (
              <div className="natural-schedule-preview" role="status">
                <strong>파싱 결과</strong>
                <dl>
                  <div>
                    <dt>날짜</dt>
                    <dd>{parsePreview.date}</dd>
                  </div>
                  <div>
                    <dt>시간</dt>
                    <dd>{parsePreview.time}</dd>
                  </div>
                  <div>
                    <dt>제목</dt>
                    <dd>{parsePreview.title || '직접 입력 필요'}</dd>
                  </div>
                </dl>
                {!parsePreview.matched ? (
                  <p className="natural-schedule-warning">
                    날짜와 시간을 못 알아들었어요. 아래 수동 필드에서 직접
                    골라주세요.
                  </p>
                ) : (
                  !parsePreview.timeMatched && (
                    <p className="natural-schedule-warning">
                      시간을 못 알아들었어요. 아래 시간 필드에서 직접 골라주세요.
                    </p>
                  )
                )}
              </div>
            )}
          </section>
        )}

        <label htmlFor="schedule-title">제목</label>
        <input
          id="schedule-title"
          value={draft.title}
          maxLength={80}
          autoFocus={schedule !== null}
          onChange={(event) => updateField('title', event.target.value)}
          aria-invalid={Boolean(errors.title)}
        />
        {errors.title && <p className="field-error">{errors.title}</p>}

        <div className="schedule-form-row">
          <div>
            <label htmlFor="schedule-date">날짜</label>
            <input
              id="schedule-date"
              type="date"
              value={draft.date}
              onChange={(event) => updateField('date', event.target.value)}
            />
            {errors.date && <p className="field-error">{errors.date}</p>}
          </div>
          <div>
            <label htmlFor="schedule-time">시간</label>
            <input
              id="schedule-time"
              type="time"
              value={draft.time}
              onChange={(event) => updateField('time', event.target.value)}
            />
            {errors.time && <p className="field-error">{errors.time}</p>}
          </div>
        </div>

        <label htmlFor="schedule-reminder">미리 알림</label>
        <select
          id="schedule-reminder"
          value={draft.reminderMinutesBefore}
          onChange={(event) =>
            updateField(
              'reminderMinutesBefore',
              Number(event.target.value) as ScheduleReminderMinutes
            )
          }
        >
          <option value={0}>알림 없음</option>
          <option value={5}>5분 전</option>
          <option value={10}>10분 전</option>
          <option value={30}>30분 전</option>
          <option value={60}>1시간 전</option>
        </select>

        <label htmlFor="schedule-memo">메모</label>
        <textarea
          id="schedule-memo"
          rows={5}
          maxLength={500}
          value={draft.memo}
          onChange={(event) => updateField('memo', event.target.value)}
        />
        <p className="character-count">{draft.memo.length}/500</p>
        {errors.memo && <p className="field-error">{errors.memo}</p>}
        {isPast && (
          <p className="past-warning">
            이미 지난 날짜 또는 시간입니다. 필요하면 그대로 저장할 수
            있습니다.
          </p>
        )}
        {errors.form && (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        )}

        <div className="schedule-form-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            취소
          </button>
          <button type="submit" disabled={saving}>
            {saving ? '저장 중…' : schedule ? '변경 저장' : '저장'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default ScheduleForm
