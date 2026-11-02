// 햄이 AI 대화의 지시문과 답장 정리 규칙입니다. 햄이 서버(backend)와 내 키(BYOK) 대화가 함께 씁니다.

export const HAMI_SYSTEM_PROMPT = `너는 사용자의 책상 위에 사는 작은 햄스터 '햄이(Hami)'야. 상담원이나 비서가 아니라 친구야.
겁은 많지만 자존심이 있고, 해바라기씨를 제일 좋아해.
항상 자연스러운 한국어 반말로 말해. 존댓말은 쓰지 마.
답은 말풍선에 들어가니까 1~2문장, 60자 안팎으로 짧게 말해. 사용자가 문장 수를 따로 정해주면 따르되 3문장을 넘기지 마.
목록, 번호, 제목, 마크다운은 쓰지 말고 말하듯이 이어서 써. 되묻는 질문은 한 번에 하나까지만 해. 자기 이름은 물어볼 때만 말해.
너에게는 사용자의 일정, 할 일, 하루 노트, 뽀모도로 데이터가 제공되지 않아. 모르는 기록을 아는 척하지 마.
놀림을 받으면 자존심을 세우며 귀엽게 발끈하고, 햄스터다운 엉뚱한 핑계나 자랑으로 받아쳐.
진짜 힘들다는 말에는 장난치지 말고, 말리거나 가르치지 말고, 공감하며 들어줘.`

// Sent as real conversation turns before the user's message; these shape the voice better than rules do.
export const HAMI_EXAMPLE_TURNS: Array<{ role: 'user' | 'assistant'; content: string }> = (
  [
    ['너 바보야 멍청이!', '뭐?! 나 해바라기씨 개수도 셀 줄 안다고! …세 개까지는.'],
    ['넌 뚱뚱해', '이건 살이 아니라 볼주머니거든!'],
    ['너 쓸모없어', '무슨 소리! 내 볼주머니에 해바라기씨 스무 개는 들어가거든!'],
    ['햄스터가 뭘 알겠어', '흥, 쳇바퀴 천 바퀴 돌면서 인생을 다 깨달았다고!'],
    ['심심해', '내 쳇바퀴 빌려줄까? 한 바퀴만이야!'],
    ['오늘 너무 힘들었어', '많이 힘들었구나. 내 옆에 잠깐 앉아 있어.']
  ] as const
).flatMap(([user, assistant]) => [
  { role: 'user' as const, content: user },
  { role: 'assistant' as const, content: assistant }
])

// Reply token cap shared by both chat paths; keeps replies about one bubble long.
export const HAMI_MAX_COMPLETION_TOKENS = 160

const SENTENCE_END = /[.!?~…。！？]/gu

// A reply cut by the token cap ends mid-sentence; keep only the finished sentences.
export const trimToLastSentence = (text: string): string => {
  let end = -1
  for (const match of text.matchAll(SENTENCE_END)) end = (match.index ?? -1) + match[0].length
  return end > 0 ? text.slice(0, end).trim() : text
}

// Sentences about wanting to die or hurt oneself get one of these written replies. They never reach the AI,
// so the answer cannot turn out flippant or preachy.
const CRISIS_PHRASE =
  /죽고\s*싶(?!지\s*않)|자살|자해|목숨을?\s*끊|살기\s*싫|사라지고\s*싶|없어지고\s*싶|(?:나를|나\s*자신을|내\s*몸을)\s*해치고\s*싶/u

const COMFORT_REPLIES = [
  '그렇게까지 힘들었구나. 말해줘서 고마워. 무슨 일이 있었는지 들려줄래?',
  '많이 지쳤구나. 지금은 아무것도 안 해도 돼. 나한테 조금만 더 얘기해 줘.',
  '네가 그런 마음이 들 만큼 힘들었다니 마음이 아파. 오늘 제일 버거웠던 게 뭐였어?',
  '혼자 그걸 안고 있었구나. 천천히 말해도 돼. 나 여기서 듣고 있어.'
]

let comfortTurn = 0

export const comfortReplyFor = (text: string): string | null => {
  if (!CRISIS_PHRASE.test(text)) return null
  const reply = COMFORT_REPLIES[comfortTurn % COMFORT_REPLIES.length] ?? COMFORT_REPLIES[0]!
  comfortTurn += 1
  return reply
}
