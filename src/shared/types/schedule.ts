// 일정 다이어리의 저장 모델과 IPC 입력 형식을 정의하는 파일입니다.
export type ScheduleStatus = 'scheduled' | 'completed'

export type ScheduleReminderMinutes = 0 | 5 | 10 | 30 | 60

export interface ScheduleDraft {
  title: string
  date: string
  time: string
  reminderMinutesBefore: ScheduleReminderMinutes
  memo: string
}

export interface Schedule {
  id: string
  title: string
  startAt: string
  reminderMinutesBefore: ScheduleReminderMinutes
  memo: string
  status: ScheduleStatus
  createdAt: string
  updatedAt: string
}

export interface UpdateSchedulePayload {
  id: string
  draft: ScheduleDraft
}

export interface SetScheduleCompletedPayload {
  id: string
  completed: boolean
}
