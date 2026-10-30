// 하루 계획을 햄이(AI)에게 보여주고, 답을 펫 말풍선으로 전하고 저장하는 서비스입니다.
import type { PetEmotion } from '../../shared/types/pet'
import type { DailyPlan, DailyPlanCommentResult } from '../../shared/types/plan'
import { dailyPlanStore } from '../stores/dailyPlanStore'
import { converseWithHami } from './hamiChatService'

// The chat server caps one message at 1,000 UTF-16 units, instruction included.
const MAX_MESSAGE_LENGTH = 1_000
const INSTRUCTION = `아래는 내 하루 계획이야. 읽고 3~4문장으로 응원해줘.
계획에 적힌 내용을 구체적으로 짚어서 말해주고, 무리해 보이면 우선순위 하나만 부담 없이 제안해줘.
훈계하거나 가르치려 들지 말고, 친구처럼 담백하게 말해줘.`

const THINKING_TEXT = '어디 보자… 오늘 계획 읽어볼게!'
const NOT_CONFIGURED_TEXT = '아직 AI 대화 서버가 연결되지 않아서 계획을 못 읽었어.'
const FAILED_TEXT = '지금은 계획을 잘 못 읽겠어. 잠깐 뒤에 다시 보여줘!'

export interface PetSpeaker {
  think: (text: string) => void
  speak: (text: string, finalEmotion: PetEmotion) => void
}

const buildMessage = (planText: string): { message: string; truncated: boolean } => {
  const prefix = `${INSTRUCTION}\n\n---\n`
  const budget = MAX_MESSAGE_LENGTH - prefix.length
  const text = planText.trim()
  let excerpt = ''
  // Iterate by code point so a cut never splits a surrogate pair.
  for (const char of text) {
    if (excerpt.length + char.length > budget) break
    excerpt += char
  }
  return { message: prefix + excerpt, truncated: excerpt.length < text.length }
}

export const commentOnDailyPlan = async (
  date: string,
  pet: PetSpeaker
): Promise<DailyPlanCommentResult> => {
  const key = `plan:${date}`
  const plan = dailyPlanStore.get(key)
  if (!plan || plan.text.trim().length === 0) {
    return { status: 'empty', truncated: false, plan: plan ?? null }
  }

  const { message, truncated } = buildMessage(plan.text)
  pet.think(THINKING_TEXT)
  try {
    const response = await converseWithHami({ message, history: [] })
    if (response.limited) {
      pet.speak(response.reply, 'sad')
      return { status: 'limited', truncated, plan }
    }
    // The page may have been edited (or emptied) while the hamster was reading.
    const latest = dailyPlanStore.get(key)
    let updated: DailyPlan | null = null
    if (latest) {
      updated = {
        ...latest,
        hamsterReply: response.reply,
        commentedAt: new Date().toISOString()
      }
      dailyPlanStore.set(key, updated)
    }
    pet.speak(response.reply, 'happy')
    return { status: 'ok', truncated, plan: updated }
  } catch (error) {
    const notConfigured =
      error instanceof Error && error.message.includes('[HAMI_CHAT_NOT_CONFIGURED]')
    console.warn('[plan:comment] failed', error)
    pet.speak(notConfigured ? NOT_CONFIGURED_TEXT : FAILED_TEXT, 'sad')
    return { status: notConfigured ? 'not-configured' : 'error', truncated, plan }
  }
}
