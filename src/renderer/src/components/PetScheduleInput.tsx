// 펫 창 내부에서 자연어 일정을 확인·수정해 기존 저장 경로로 전달하는 입력바입니다.
import { useEffect, useState } from 'react'
import type { PetScheduleInputPlacement } from '../../../shared/types/pet'
import { parseSchedule, type ParsedSchedule } from '../scheduleParser'

interface PetScheduleInputProps {
  side: PetScheduleInputPlacement['side']
  onClose: () => void
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^\d{2}:\d{2}$/

function PetScheduleInput({
  side,
  onClose
}: PetScheduleInputProps): React.JSX.Element {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<ParsedSchedule | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const parseText = (): void => {
    const normalized = text.trim()
    if (!normalized) {
      setPreview(null)
      setError('일정 문장을 입력해주세요.')
      return
    }
    setPreview(parseSchedule(normalized))
    setError('')
  }

  const updatePreview = (
    field: 'title' | 'date' | 'time',
    value: string
  ): void => {
    setPreview((current) =>
      current === null ? null : { ...current, [field]: value }
    )
    setError('')
  }

  const save = async (): Promise<void> => {
    if (!preview || saving) {
      return
    }
    if (!preview.title.trim()) {
      setError('일정 제목을 입력해주세요.')
      return
    }
    if (!DATE_PATTERN.test(preview.date) || !TIME_PATTERN.test(preview.time)) {
      setError('날짜와 시간을 확인해주세요.')
      return
    }

    setSaving(true)
    try {
      await window.desktopPetAPI.createSchedule({
        title: preview.title.trim(),
        date: preview.date,
        time: preview.time,
        reminderMinutesBefore: 10,
        memo: ''
      })
      onClose()
    } catch {
      setError('일정을 저장하지 못했습니다. 입력값을 확인해주세요.')
      setSaving(false)
    }
  }

  return (
    <section
      className={`pet-inline-input is-${side}`}
      data-pet-schedule-input
      data-interactive-hitbox="true"
      aria-label="햄스터에게 일정 말하기"
    >
      <div className="pet-inline-query">
        <input
          value={text}
          maxLength={200}
          autoFocus
          placeholder="내일 오후 3시 회의"
          aria-label="자연어 일정"
          onChange={(event) => {
            setText(event.target.value)
            setPreview(null)
            setError('')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              parseText()
            }
          }}
        />
        <button type="button" className="confirm" onClick={parseText}>
          확인
        </button>
        <button type="button" className="close" aria-label="입력바 닫기" onClick={onClose}>
          ×
        </button>
      </div>

      {preview && (
        <div className="pet-inline-preview" aria-label="일정 미리보기">
          <input
            value={preview.title}
            maxLength={80}
            aria-label="일정 제목"
            onChange={(event) => updatePreview('title', event.target.value)}
          />
          <div>
            <input
              type="date"
              value={preview.date}
              aria-label="일정 날짜"
              onChange={(event) => updatePreview('date', event.target.value)}
            />
            <input
              type="time"
              value={preview.time}
              aria-label="일정 시간"
              onChange={(event) => updatePreview('time', event.target.value)}
            />
          </div>
          {!preview.matched ? (
            <p>날짜와 시간을 못 알아들었어요. 직접 확인해주세요.</p>
          ) : (
            !preview.timeMatched && <p>시간을 직접 확인해주세요.</p>
          )}
          <button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? '저장 중' : '일정 저장'}
          </button>
        </div>
      )}

      {error && <p className="pet-inline-error" role="alert">{error}</p>}
    </section>
  )
}

export default PetScheduleInput
