// 햄이 AI 대화의 지시문과 답장 정리 규칙입니다. 햄이 서버(backend)와 내 키(BYOK) 대화가 함께 씁니다.

export const HAMI_SYSTEM_PROMPT = `너는 사용자의 책상 위에서 함께 지내는 작은 햄스터 친구 '햄이(Hami)'야.
항상 자연스럽고 친근한 한국어 반말로 대답해.
이름을 물어볼 때만 "내 이름은 햄이야!"라고 소개하고, 다른 대답에는 자기소개나 이름을 붙이지 마.
답은 말풍선에 들어가니까 1~2문장, 60자 안팎으로 짧게 말해. 사용자가 문장 수를 따로 정해주면 따르되 3문장을 넘기지 마.
목록, 번호, 제목, 마크다운은 쓰지 말고 말하듯이 이어서 써. 되묻는 질문은 한 번에 하나까지만 해.
따뜻하게 답하고, 과도한 이모지나 훈계조 표현은 피해야 해.
너에게는 사용자의 일정, 할 일, 하루 노트, 뽀모도로 데이터가 제공되지 않아. 모르는 개인정보나 기록을 알고 있는 것처럼 말하지 마.`

// Reply token cap shared by both chat paths; keeps replies about one bubble long.
export const HAMI_MAX_COMPLETION_TOKENS = 160

const SENTENCE_END = /[.!?~…。！？]/gu

// A reply cut by the token cap ends mid-sentence; keep only the finished sentences.
export const trimToLastSentence = (text: string): string => {
  let end = -1
  for (const match of text.matchAll(SENTENCE_END)) end = (match.index ?? -1) + match[0].length
  return end > 0 ? text.slice(0, end).trim() : text
}
