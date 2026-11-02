// 일기 탭은 하루 노트로 합쳐졌습니다. 예전 diary.json을 읽어 옮길 때만 쓰는 형식입니다.
export interface DiaryEntry {
  date: string
  text: string
  updatedAt: string
  hamsterReply?: string
  comfortedAt?: string
}
