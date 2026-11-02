// 대화창에 입력한 말이 일정 추가·조회·옮기기·취소인지 로컬에서 판단하고, 햄이 답장 문구를 만드는 함수들입니다.
// 일정 문장은 AI로 보내지 않습니다.
import type { Schedule } from '../../shared/types/schedule'
import { parseSchedule, type ParsedSchedule } from './scheduleParser'

export type ScheduleIntent =
  | { kind: 'add'; items: ParsedSchedule[] }
  | { kind: 'query'; from: string; to: string; label: string }
  | { kind: 'move'; target: string; onDate?: string; date?: string; time?: string }
  | { kind: 'delete'; target: string; onDate?: string }

const pad = (value: number): string => String(value).padStart(2, '0')

export const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const addDays = (date: Date, days: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

export const scheduleDateTime = (schedule: Schedule): { date: string; time: string } => {
  const start = new Date(schedule.startAt)
  return { date: toDateKey(start), time: `${pad(start.getHours())}:${pad(start.getMinutes())}` }
}

const DELETE_VERB = /(?:취소|삭제|지워|지우|없애|빼)\S*/u
const MOVE_VERB = /(?:옮겨|옮기|바꿔|바꾸|변경|미뤄|미루|당겨|당기)\S*/u
const QUERY_PHRASE =
  /(?:뭐\s*있|뭐\s*하더라|일정\s*(?:알려|보여|확인|뭐|있)|스케줄|있더라|있었지|있었나|약속\s*있)/u
const ADD_REQUEST =
  /(?:일정\s*)?(?:잡아\s*줘|잡아줘|잡아|추가해\s*줘|추가해줘|추가|넣어\s*줘|넣어줘|넣어|등록해\s*줘|등록|기록해\s*줘)\s*[.!~]*$/u
// Chatty sentence endings ("떨려", "귀찮아") mean it is a conversation, not a schedule title.
const SENTENCE_ENDING = /(?:다|요|어|아|야|네|지|래|까|해|려|게|고|서|데|나|니|죠)[.!?~]*$/u
const MAX_TITLE_LENGTH = 25
// "나 내일 5시 병원 예약있어": stating a plan, which names a schedule when it has a date and a time.
const STATEMENT_ENDING =
  /\s*(?:있어요|있어|있다|있음|있네|있거든|있습니다|잡혔어|잡혀\s*있어|가야\s*(?:해요|해|돼요|돼|됨|함)|가야겠어|갈\s*거야)[.!~]*$/u
const SPEAKER = /^(?:나는|저는|내가|제가|나|저)\s+/u
// "회의 있는데 너무 귀찮아" -> "회의"
const CHATTY_TAIL = /\s*(?:있어서|있는데|있으니|이라서|이라|라서|인데|때문에).*$/u

// A schedule title from what is left of a sentence once the date and time are gone.
const cleanTitle = (text: string): string => {
  const cleaned = text
    .replace(/일정|스케줄/gu, ' ')
    .replace(/[?!.~]+/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(SPEAKER, '')
    .replace(/\s+(?:을|를|으로|로)$/u, '')
  const withoutEnding = cleaned.replace(STATEMENT_ENDING, '')
  if (withoutEnding === cleaned) return cleaned
  // "회의가 있어" -> "회의", while "요가 있어" keeps its 가.
  const withoutParticle = withoutEnding.replace(/[이가]$/u, '')
  return withoutParticle.length >= 2 ? withoutParticle : withoutEnding
}

const cleanTarget = (text: string): string =>
  text
    .replace(/일정|스케줄/gu, ' ')
    .replace(/\s*(?:을|를|은|는|이|가|으로|로|좀|해\s*줘|해줘|줘)\s*$/u, '')
    .replace(/\s*(?:을|를|은|는|이|가|으로|로)\s*$/u, '')
    .replace(/[?!.~]+/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

const weekRange = (now: Date, weekOffset: number): { from: string; to: string } => {
  const monday = addDays(now, -((now.getDay() + 6) % 7) + weekOffset * 7)
  return { from: toDateKey(monday), to: toDateKey(addDays(monday, 6)) }
}

const detectQuery = (text: string, now: Date): ScheduleIntent | null => {
  if (!QUERY_PHRASE.test(text) && !(/일정/u.test(text) && /\?/u.test(text))) return null
  if (/이번\s*주/u.test(text)) return { kind: 'query', ...weekRange(now, 0), label: '이번 주' }
  if (/다음\s*주/u.test(text)) return { kind: 'query', ...weekRange(now, 1), label: '다음 주' }
  const parsed = parseSchedule(text, now)
  if (parsed.dateMatched) {
    return { kind: 'query', from: parsed.date, to: parsed.date, label: dateLabel(parsed.date, now) }
  }
  return { kind: 'query', from: toDateKey(now), to: toDateKey(addDays(now, 6)), label: '앞으로 일주일' }
}

const looksLikeTitle = (title: string): boolean =>
  title.length > 0 &&
  title.length <= MAX_TITLE_LENGTH &&
  !/\?/u.test(title) &&
  !SENTENCE_ENDING.test(title)

// A stated plan needs both a date and a time; anything vaguer stays conversation.
const detectStatement = (text: string, now: Date): ScheduleIntent | null => {
  if (/\?/u.test(text) || !STATEMENT_ENDING.test(text)) return null
  const parsed = parseSchedule(text, now)
  const title = cleanTitle(parsed.title)
  if (!parsed.dateMatched || !parsed.timeMatched || !title || title.length > MAX_TITLE_LENGTH) return null
  return { kind: 'add', items: [{ ...parsed, title }] }
}

// A sentence sent to chat that still names a date and a time, offered as a schedule after the reply.
export const findMissedSchedule = (input: string, now = new Date()): ParsedSchedule | null => {
  const text = input.trim().replace(/\s{2,}/g, ' ')
  if (/\?/u.test(text)) return null
  const parsed = parseSchedule(text, now)
  const title = cleanTitle(parsed.title.replace(CHATTY_TAIL, ''))
  if (!parsed.dateMatched || !parsed.timeMatched || !title || title.length > MAX_TITLE_LENGTH) return null
  return { ...parsed, title }
}

const detectAdd = (text: string, now: Date): ScheduleIntent | null => {
  const explicit = ADD_REQUEST.test(text)
  const body = text.replace(ADD_REQUEST, '').trim()
  const parts = body.split(/\s*(?:,|，|\n|그리고)\s*/u).filter(Boolean)
  if (parts.length === 0 || parts.length > 5) return null
  const items = parts.map((part) => {
    const parsed = parseSchedule(part, now)
    return { ...parsed, title: cleanTitle(parsed.title) }
  })
  // A question ("내일 날씨 어때?") is conversation unless it asks to add something.
  if (!explicit && /\?/u.test(text)) return null
  const valid = items.every(
    (item) =>
      (item.dateMatched || item.timeMatched) &&
      (explicit ? item.title.length > 0 && item.title.length <= 80 : looksLikeTitle(item.title))
  )
  return valid ? { kind: 'add', items } : null
}

export const detectScheduleIntent = (input: string, now = new Date()): ScheduleIntent | null => {
  const text = input.trim().replace(/\s{2,}/g, ' ')
  if (!text || text.length > 120) return null

  const deleteVerb = DELETE_VERB.exec(text)
  if (deleteVerb) {
    const parsed = parseSchedule(text.slice(0, deleteVerb.index), now)
    const target = cleanTarget(parsed.title)
    if (!target) return null
    return { kind: 'delete', target, onDate: parsed.dateMatched ? parsed.date : undefined }
  }

  const moveVerb = MOVE_VERB.exec(text)
  if (moveVerb) {
    const parsed = parseSchedule(text.slice(0, moveVerb.index), now)
    const target = cleanTarget(parsed.title)
    if (!target || (!parsed.dateMatched && !parsed.timeMatched)) return null
    return {
      kind: 'move',
      target,
      date: parsed.dateMatched ? parsed.date : undefined,
      time: parsed.timeMatched ? parsed.time : undefined
    }
  }

  return detectStatement(text, now) ?? detectQuery(text, now) ?? detectAdd(text, now)
}

// Upcoming schedules whose title contains the target, ignoring spaces and case.
export const findScheduleTargets = (
  schedules: Schedule[],
  target: string,
  now = new Date(),
  onDate?: string
): Schedule[] => {
  const key = (value: string): string => value.replace(/\s/g, '').toLocaleLowerCase('ko-KR')
  const wanted = key(target)
  const today = toDateKey(now)
  return schedules.filter((schedule) => {
    const { date } = scheduleDateTime(schedule)
    return (
      schedule.status !== 'completed' &&
      (onDate ? date === onDate : date >= today) &&
      key(schedule.title).includes(wanted)
    )
  })
}

export const schedulesInRange = (schedules: Schedule[], from: string, to: string): Schedule[] =>
  schedules.filter((schedule) => {
    const { date } = scheduleDateTime(schedule)
    return date >= from && date <= to
  })

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export const dateLabel = (date: string, now = new Date()): string => {
  const [year, month, day] = date.split('-').map(Number)
  const target = new Date(year, month - 1, day)
  const diff = Math.round((target.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '내일'
  if (diff === 2) return '모레'
  return `${month}월 ${day}일(${WEEKDAYS[target.getDay()]})`
}

export const timeLabel = (time: string): string => {
  const [hour, minute] = time.split(':').map(Number)
  const period = hour < 12 ? '오전' : '오후'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${period} ${hour12}시${minute ? ` ${minute}분` : ''}`
}

export const whenLabel = (date: string, time: string, now = new Date()): string =>
  `${dateLabel(date, now)} ${timeLabel(time)}`

export const scheduleWhenLabel = (schedule: Schedule, now = new Date()): string => {
  const { date, time } = scheduleDateTime(schedule)
  return whenLabel(date, time, now)
}

const QUERY_LIST_LIMIT = 3

// "내일은", "이번 주는", "11월 3일(화)에는": pick the topic particle for a label.
const withTopic = (label: string): string => {
  const last = label.charCodeAt(label.length - 1)
  if (last < 0xac00 || last > 0xd7a3) return `${label}에는`
  return `${label}${(last - 0xac00) % 28 === 0 ? '는' : '은'}`
}

export const describeSchedules = (
  schedules: Schedule[],
  label: string,
  multiDay: boolean,
  now = new Date()
): { text: string; hasMore: boolean } => {
  if (schedules.length === 0) {
    return { text: `${withTopic(label)} 일정이 없어. 여유로운 시간이네! 🐹`, hasMore: false }
  }
  const shown = schedules.slice(0, QUERY_LIST_LIMIT).map((schedule) => {
    const { date, time } = scheduleDateTime(schedule)
    return `${multiDay ? whenLabel(date, time, now) : timeLabel(time)} ${schedule.title}`
  })
  const rest = schedules.length - shown.length
  return {
    text: `${withTopic(label)} ${schedules.length}개 있어. ${shown.join(', ')}${rest > 0 ? ` 외 ${rest}개는 달력에서 봐줘!` : '.'}`,
    hasMore: rest > 0
  }
}
