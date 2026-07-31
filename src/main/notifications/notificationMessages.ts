// 일정·물·스트레칭 알림의 햄스터 말투 문구를 생성하는 파일입니다.
import type { Schedule } from '../../shared/types/schedule'
import type { ReminderKind } from '../../shared/types/notifications'

const SCHEDULE_MESSAGES = [
  (title: string, time: string, _minutes: number) =>
    `곧 ${title} 시간이야! (${time}) 준비됐어?`,
  (title: string, _time: string, minutes: number) =>
    `${title} ${minutes}분 전! 슬슬 움직여볼까?`,
  (title: string, time: string, _minutes: number) =>
    `${time} ${title}, 잊지 않게 내가 알려줄게.`
]

const WATER_MESSAGES = [
  '물 마실 시간이야! 나도 목말라 💧',
  '잠깐, 수분 충전 어때?',
  '한 모금 쉬어 가자. 물이 기다리고 있어!'
]

const STRETCH_MESSAGES = [
  '허리 펴자! 나처럼 쭉~',
  '잠깐 일어나서 몸 좀 풀어줄래?',
  '어깨를 한 번 돌려 볼까? 금방 개운해질 거야.'
]

const pick = <T>(items: T[]): T =>
  items[Math.floor(Math.random() * items.length)]

export const createScheduleReminderMessage = (
  schedule: Schedule,
  minutesBefore: number
): string => {
  const time = new Date(schedule.startAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit'
  })
  return pick(SCHEDULE_MESSAGES)(schedule.title, time, minutesBefore)
}

export const createRepeatingReminderMessage = (
  kind: ReminderKind
): string => pick(kind === 'water' ? WATER_MESSAGES : STRETCH_MESSAGES)
