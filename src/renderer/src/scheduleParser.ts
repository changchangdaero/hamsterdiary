// 한국어 일정 문장에서 날짜·시간·제목을 로컬 규칙으로 추출하는 순수 함수입니다.
export interface ParsedSchedule {
  date: string
  time: string
  title: string
  matched: boolean
  dateMatched: boolean
  timeMatched: boolean
}

const WEEKDAY_INDEX: Record<string, number> = {
  일: 0,
  월: 1,
  화: 2,
  수: 3,
  목: 4,
  금: 5,
  토: 6
}

const pad = (value: number): string => String(value).padStart(2, '0')

const toDateString = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const isValidDate = (year: number, month: number, day: number): boolean => {
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

const addDays = (date: Date, days: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

const removeMatchedText = (
  source: string,
  match: RegExpExecArray
): string =>
  `${source.slice(0, match.index)} ${source.slice(match.index + match[0].length)}`

const normalizeTitle = (text: string): string =>
  text
    .replace(/^[\s,./~-]+|[\s,./~-]+$/g, '')
    .replace(/^(?:에|에는|부터|까지)\s+/, '')
    .replace(/\s+(?:에|에는|부터|까지)$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

interface DateParseResult {
  date: Date
  remaining: string
  matched: boolean
}

const parseDate = (text: string, now: Date): DateParseResult => {
  const absoluteYear =
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/.exec(text)
  if (absoluteYear) {
    const year = Number(absoluteYear[1])
    const month = Number(absoluteYear[2])
    const day = Number(absoluteYear[3])
    if (isValidDate(year, month, day)) {
      return {
        date: new Date(year, month - 1, day),
        remaining: removeMatchedText(text, absoluteYear),
        matched: true
      }
    }
  }

  const absoluteMonthDay =
    /(\d{1,2})월\s*(\d{1,2})일|(\d{1,2})\/(\d{1,2})/.exec(text)
  if (absoluteMonthDay) {
    const month = Number(absoluteMonthDay[1] ?? absoluteMonthDay[3])
    const day = Number(absoluteMonthDay[2] ?? absoluteMonthDay[4])
    const year = now.getFullYear()
    if (isValidDate(year, month, day)) {
      return {
        date: new Date(year, month - 1, day),
        remaining: removeMatchedText(text, absoluteMonthDay),
        matched: true
      }
    }
  }

  const relative = /(오늘|내일|모레|글피)/.exec(text)
  if (relative) {
    const offsets: Record<string, number> = {
      오늘: 0,
      내일: 1,
      모레: 2,
      글피: 3
    }
    return {
      date: addDays(now, offsets[relative[1]]),
      remaining: removeMatchedText(text, relative),
      matched: true
    }
  }

  const weekday =
    /(?:(이번\s*주|다음\s*주)\s*)?([월화수목금토일])요일/.exec(text)
  if (weekday) {
    const targetDay = WEEKDAY_INDEX[weekday[2]]
    const qualifier = weekday[1]?.replace(/\s/g, '')
    let date: Date

    if (qualifier) {
      const daysFromMonday = (now.getDay() + 6) % 7
      const thisMonday = addDays(now, -daysFromMonday)
      const weekOffset = qualifier === '다음주' ? 7 : 0
      const targetFromMonday = targetDay === 0 ? 6 : targetDay - 1
      date = addDays(thisMonday, weekOffset + targetFromMonday)
    } else {
      date = addDays(now, (targetDay - now.getDay() + 7) % 7)
    }

    return {
      date,
      remaining: removeMatchedText(text, weekday),
      matched: true
    }
  }

  return {
    date: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    remaining: text,
    matched: false
  }
}

interface TimeParseResult {
  time: string
  remaining: string
  matched: boolean
}

const parseTime = (text: string): TimeParseResult => {
  const timeExpression =
    /(오전|오후|저녁|아침|새벽|점심)?\s*(\d{1,2})시(?:\s*(?:(\d{1,2})분|(반)))?/.exec(
      text
    )

  if (timeExpression) {
    const period = timeExpression[1]
    let hour = Number(timeExpression[2])
    const minute = timeExpression[4] ? 30 : Number(timeExpression[3] ?? 0)

    if (period === '오후' || period === '저녁' || period === '점심') {
      if (hour < 12) hour += 12
    } else if (!period && hour >= 1 && hour <= 6) {
      // "3시 병원" almost always means the afternoon.
      hour += 12
    } else if (
      (period === '오전' || period === '아침' || period === '새벽') &&
      hour === 12
    ) {
      hour = 0
    }

    if (hour <= 23 && minute <= 59) {
      return {
        time: `${pad(hour)}:${pad(minute)}`,
        remaining: removeMatchedText(text, timeExpression),
        matched: true
      }
    }
  }

  const lunch = /점심/.exec(text)
  if (lunch) {
    return {
      time: '12:00',
      remaining: removeMatchedText(text, lunch),
      matched: true
    }
  }

  return {
    time: '09:00',
    remaining: text,
    matched: false
  }
}

export const parseSchedule = (
  text: string,
  now = new Date()
): ParsedSchedule => {
  const normalized = text.trim().replace(/\s{2,}/g, ' ')
  const dateResult = parseDate(normalized, now)
  const timeResult = parseTime(dateResult.remaining)

  return {
    date: toDateString(dateResult.date),
    time: timeResult.time,
    title: normalizeTitle(timeResult.remaining),
    matched: dateResult.matched || timeResult.matched,
    dateMatched: dateResult.matched,
    timeMatched: timeResult.matched
  }
}
