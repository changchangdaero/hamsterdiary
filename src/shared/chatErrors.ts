// AI 대화 오류 코드를 햄이가 말풍선으로 할 말로 바꿉니다. 대화창과 하루 계획 멘트가 함께 씁니다.

const REPLIES: Array<[tag: string, reply: string]> = [
  ['[HAMI_CHAT_NOT_CONFIGURED]', 'AI 대화 서버가 아직 연결되지 않았어. 일정은 "내일 3시 병원"처럼 말해주면 넣어줄게! 🐹'],
  ['[BYOK_NO_KEY]', '내 API 키가 아직 없어. 설정 → 대화에서 키를 넣거나 햄이 서버로 바꿔줘!'],
  ['[BYOK_INVALID_KEY]', 'API 키가 맞지 않는 것 같아. 설정 → 대화에서 키를 확인해줘!'],
  ['[BYOK_RATE_LIMITED]', '내 키의 사용 한도나 잔액이 다 찬 것 같아. 제공사 대시보드를 확인하거나 햄이 서버로 바꿔줘!'],
  ['[BYOK_BAD_MODEL]', '고른 모델을 이 키로는 쓸 수 없대. 설정 → 대화에서 다른 모델을 골라줘!']
]

export const FALLBACK_CHAT_REPLY = '지금은 대답하기가 조금 어려워. 잠시 후에 다시 말 걸어줘! 🐹'

export const friendlyChatError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return REPLIES.find(([tag]) => message.includes(tag))?.[1] ?? FALLBACK_CHAT_REPLY
}
