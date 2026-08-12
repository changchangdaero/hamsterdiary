export interface DiaryEntry {
  date: string
  text: string
  updatedAt: string
  hamsterReply?: string
  comfortedAt?: string
}

export interface SaveDiaryPayload {
  date: string
  text: string
}

export interface DiaryComfortResponse {
  status: 'ok' | 'empty'
  reply: string
}
