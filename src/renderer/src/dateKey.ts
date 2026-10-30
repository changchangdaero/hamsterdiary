// 렌더러 창들이 함께 쓰는 로컬 날짜 키(YYYY-MM-DD)와 월간 달력 계산 헬퍼입니다.
export const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export interface CalendarDay {
  date: Date
  key: string
  inCurrentMonth: boolean
}

const pad = (value: number): string => String(value).padStart(2, '0')

export const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const fromDateKey = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const moveDateKey = (dateKey: string, offset: number): string => {
  const date = fromDateKey(dateKey)
  return toDateKey(
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset)
  )
}

export const formatDateKey = (dateKey: string): string => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return `${year}년 ${month}월 ${day}일`
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
