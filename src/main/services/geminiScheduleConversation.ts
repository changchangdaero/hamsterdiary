import {
  SCHEDULE_CONVERSATION_INTENTS,
  SCHEDULE_CONVERSATION_PHASES,
  type ScheduleConversationRequest,
  type ScheduleConversationResponse
} from '../../shared/types/scheduleConversation'
import type { Schedule } from '../../shared/types/schedule'
import type { BatchScheduleResult } from '../ipc/registerScheduleIpc'
import { fetchGeminiQueued } from './geminiRequestQueue'
import { getGeminiApiKey } from './geminiKeyService'

const GEMINI_MODEL = 'gemini-3.5-flash-lite'
const GEMINI_TIMEOUT_MS = 75_000
const MAX_FUNCTION_CALL_ITERATIONS = 3
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

interface GeminiPart {
  text?: string
  functionCall?: {
    id?: string
    name?: string
    args?: Record<string, unknown>
  }
  [key: string]: unknown
}

interface GeminiContent {
  role?: string
  parts?: GeminiPart[]
}

interface GeminiResponse {
  candidates?: Array<{ content?: GeminiContent }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
}

interface ScheduleToolContext {
  listSchedules: (
    dateFrom?: unknown,
    dateTo?: unknown,
    query?: unknown
  ) => Schedule[]
  createSchedule: (title: unknown, date: unknown, time: unknown) => Schedule[]
  createSchedules: (items: unknown) => BatchScheduleResult
  deleteSchedule: (eventId: unknown) => Schedule[]
  deleteSchedules: (eventIds: unknown) => BatchScheduleResult
  deleteSchedulesByRange: (
    dateFrom: unknown,
    dateTo: unknown,
    query?: unknown
  ) => BatchScheduleResult
  moveSchedule: (
    eventId: unknown,
    newDate: unknown,
    newTime: unknown
  ) => Schedule[]
  schedulesChanged: (schedules: Schedule[]) => void
}

const scheduleTools = [
  {
    functionDeclarations: [
      {
        name: 'list_schedules',
        description:
          'electron-store에 실제 저장된 일정을 조회한다. 전체 조회는 인자를 생략하고 날짜 또는 제목 검색이 필요할 때만 필터를 전달한다. 조회 답변은 반드시 이 함수 결과만 근거로 한다.',
        parameters: {
          type: 'object',
          properties: {
            dateFrom: {
              type: 'string',
              description: '조회 시작일, YYYY-MM-DD. 전체 조회면 생략'
            },
            dateTo: {
              type: 'string',
              description: '조회 종료일, YYYY-MM-DD. 전체 조회면 생략'
            },
            query: {
              type: 'string',
              description: '일정 제목 검색어. 전체 조회면 생략'
            }
          }
        }
      },
      {
        name: 'create_schedule',
        description:
          '사용자가 제목·날짜·시간이 모두 포함된 새 일정안을 명확히 최종 확인한 뒤에만 실제 저장한다. 확인 전이나 제목이 없을 때는 절대 호출하지 않는다.',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: '명령어가 아닌 실제 일정 제목'
            },
            date: { type: 'string', description: '일정 날짜, YYYY-MM-DD' },
            time: { type: 'string', description: '일정 시각, HH:mm' }
          },
          required: ['title', 'date', 'time']
        }
      },
      {
        name: 'create_schedules',
        description:
          '사용자가 최대 20개의 새 일정 목록 전체를 확인한 뒤 한 번에 저장한다. 확인 전에는 호출하지 않는다.',
        parameters: {
          type: 'object',
          properties: {
            schedules: {
              type: 'array',
              description: '1개 이상 20개 이하의 새 일정 목록',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  date: { type: 'string', description: 'YYYY-MM-DD' },
                  time: { type: 'string', description: 'HH:mm' }
                },
                required: ['title', 'date', 'time']
              }
            }
          },
          required: ['schedules']
        }
      },
      {
        name: 'delete_schedule',
        description:
          '기존 일정 하나를 영구 삭제한다. 현재 일정 목록에 있는 정확한 eventId만 사용한다.',
        parameters: {
          type: 'object',
          properties: {
            eventId: {
              type: 'string',
              description: '삭제할 일정의 현재 일정 목록 내 고유 id'
            }
          },
          required: ['eventId']
        }
      },
      {
        name: 'move_schedule',
        description:
          '기존 일정 하나의 날짜와 시간을 이동한다. 현재 일정 목록에 있는 정확한 eventId를 사용하고 제목 등 나머지 정보는 유지한다.',
        parameters: {
          type: 'object',
          properties: {
            eventId: {
              type: 'string',
              description: '이동할 일정의 현재 일정 목록 내 고유 id'
            },
            newDate: {
              type: 'string',
              description: '이동할 날짜, YYYY-MM-DD'
            },
            newTime: {
              type: 'string',
              description: '이동할 시각, HH:mm'
            }
          },
          required: ['eventId', 'newDate', 'newTime']
        }
      },
      {
        name: 'delete_schedules',
        description:
          '사용자가 명시적으로 전체 또는 복수 대상을 요청했고 삭제 대상 목록을 확인한 뒤, 고유 ID 목록을 한 번에 삭제한다.',
        parameters: {
          type: 'object',
          properties: {
            eventIds: {
              type: 'array',
              items: { type: 'string' },
              description: '일괄 삭제할 일정 고유 ID 목록'
            }
          },
          required: ['eventIds']
        }
      },
      {
        name: 'delete_schedules_by_range',
        description:
          '사용자가 명시한 날짜 범위에 해당하는 실제 store 일정을 내부 조회한 뒤 한 번에 삭제한다. 대상 요약 확인 후에만 호출한다.',
        parameters: {
          type: 'object',
          properties: {
            dateFrom: { type: 'string', description: 'YYYY-MM-DD' },
            dateTo: { type: 'string', description: 'YYYY-MM-DD' },
            query: {
              type: 'string',
              description: '선택적인 제목 필터'
            }
          },
          required: ['dateFrom', 'dateTo']
        }
      }
    ]
  }
]

const cancellationSchema = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: ['cancel', 'create', 'list', 'delete', 'move', 'continue'],
      description:
        'cancel은 현재 새 일정 만들기 대화 중단, create는 새 일정 생성 또는 그 수집·확인 대화, list는 저장된 일정 조회, delete는 기존 일정 삭제, move는 기존 일정 날짜/시간 이동, 나머지는 continue.'
    },
    reply: {
      type: 'string',
      description:
        'cancel이면 취소를 확인하는 친근한 반말 한 문장. 나머지는 빈 문자열.'
    },
    scope: {
      type: 'string',
      enum: ['single', 'batch_all', 'batch_range', 'batch_multiple'],
      description:
        '단일·불명확 대상은 single, 전부/모두/다는 batch_all, 기간 전체는 batch_range, 여러 새 일정 나열은 batch_multiple.'
    }
  },
  required: ['intent', 'reply', 'scope']
}

const responseSchema = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: [...SCHEDULE_CONVERSATION_INTENTS],
      description:
        '현재 일정 작업의 종류. 새 일정 생성 create, 조회 list, 삭제 delete, 이동 move, 대화 취소 cancel_conversation, 이전 대화 보충 continue, 불명확 unknown.'
    },
    phase: {
      type: 'string',
      enum: [...SCHEDULE_CONVERSATION_PHASES],
      description:
        '정보 수집 collecting, 생성 확인 confirming, 함수 실행 중 executing, 함수 성공 completed, 대화 취소 cancelled.'
    },
    items: {
      type: 'array',
      description:
        '현재 대화에서 수집·조회·선택된 일정 목록. 단일 작업도 길이 1 배열로 표현한다.',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', nullable: true },
          date: { type: 'string', nullable: true, description: 'YYYY-MM-DD' },
          time: { type: 'string', nullable: true, description: 'HH:mm' },
          eventId: { type: 'string', nullable: true }
        },
        required: ['title', 'date', 'time', 'eventId']
      }
    },
    reply: { type: 'string', description: '사용자에게 보여줄 짧고 자연스러운 한국어 답변' }
  },
  required: ['intent', 'phase', 'items', 'reply']
}

const initialResponseSchema = {
  ...responseSchema,
  properties: {
    ...responseSchema.properties,
    phase: {
      ...responseSchema.properties.phase,
      enum: SCHEDULE_CONVERSATION_PHASES.filter(
        (phase) => phase !== 'completed' && phase !== 'executing'
      ),
      description:
        '함수 실행 전에는 collecting, confirming, cancelled 중 하나. completed와 executing은 함수 실행 전 응답에 사용할 수 없다.'
    }
  }
}

const systemInstruction = (now: Date): string => `너는 사용자의 일정 비서인 햄스터야.
친근한 반말 친구처럼 자연스럽고 짧게 말해. 과한 이모지는 쓰지 말고, 필요하면 한 개 이하만 써.
사용자의 말에서 일정 제목, 날짜, 시간을 파악해. 현재까지 파악한 값은 대화 맥락을 따라 유지하고 사용자가 수정하면 갱신해.
오늘 날짜와 현재 시각은 ${now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (Asia/Seoul)이야. 내일, 모레, 다음 주 같은 상대 날짜를 정확한 YYYY-MM-DD로 계산해.

기존 일정의 삭제나 이동은 먼저 list_schedules를 호출해 실제 store 후보를 조회해야 해. 조회 결과가 정확히 하나로 확정될 때만 그 eventId로 delete_schedule 또는 move_schedule을 호출해. 후보가 여러 개면 임의로 고르지 말고 각 후보의 제목과 날짜·시간을 보여주며 어떤 일정인지 되물어. 함수를 실제 호출하고 성공 응답을 받기 전에는 삭제했다거나 옮겼다고 절대 말하지 마.
저장된 일정을 알려달라는 조회 요청은 반드시 list_schedules 함수를 호출해. 조회 답변은 함수가 반환한 실제 일정만 근거로 하고 기억이나 이 프롬프트의 목록만 보고 답하지 마.
새 일정 생성은 제목·날짜·시간을 모두 수집한 뒤 요약해서 확인을 받고, 사용자가 명확히 동의한 다음에만 create_schedule 함수를 호출해. "일정추가", "일정 추가", "등록", "잡아줘", "스케줄" 같은 명령 표현 자체는 제목이 아니야. 실제 제목이 없으면 무엇을 적을지 되물어. create_schedule 성공 전에는 저장했다고 말하지 마.

복수 작업 규칙:
- "전부", "모두", "다"처럼 사용자가 복수 전체를 명시하거나 날짜 범위를 명시한 삭제는 모호한 후보가 아니라 batch 삭제 요청이야.
- batch 삭제는 list_schedules로 실제 대상을 먼저 조회하고, items에 모든 대상의 title/date/time/eventId를 담아 개수와 내용을 요약한 뒤 phase를 confirming으로 두고 확인을 받아. 확인 전에는 삭제 함수를 호출하지 마.
- 전체나 명시 ID 목록 batch는 확인 후 delete_schedules를 한 번 호출해. 날짜 범위 batch는 확인 후 delete_schedules_by_range를 한 번 호출해.
- "회의 삭제해줘"처럼 단일 제목만 말했고 여러 일정이 매칭되면 batch가 아니야. phase collecting으로 어떤 회의인지 되물어.
- 한 메시지에 여러 새 일정이 나열되면 items에 각각 담아 최대 20개까지 수집하고, 전체 개수와 내용을 요약해 phase confirming으로 확인받아. 확인 후 create_schedules를 한 번 호출해.
- batch tool 성공 전에는 여러 일정을 추가하거나 삭제했다고 말하지 마.
- "7월과 8월"처럼 연도가 없으면 현재 연도를 사용해 7월 1일부터 8월 말일까지로 계산해. "이번 주", "다음 달"도 현재 날짜를 기준으로 정확한 dateFrom/dateTo를 계산해.

매 턴 intent와 phase를 각각 결정해. 앞선 항목이 맞으면 뒤의 항목은 적용하지 마.
1. 현재 사용자 메시지가 일정 만들기를 중단·거절·취소하려는 뜻이면 intent는 cancel_conversation, phase는 cancelled로 둬. reply로 취소했음을 짧게 알려.
   취소 예: "취소", "취소해줘", "아니 취소", "그만할래", "됐어", "안 잡을래", "그 일정 없던 걸로 해줘", "만들지 마".
   단, "취소하지 마", "취소 안 할래"처럼 취소 자체를 명확히 부정한 문장은 cancelled가 아니야.
2. 날짜, 시간, 제목이 모두 모였지만 아직 최종 동의를 받지 않았다면 intent는 create, phase는 confirming으로 둬.
3. 그 밖에 새 일정 정보가 부족하면 intent는 create, phase는 collecting으로 둬.

모든 일정 상태는 items 배열에 담아. 단일 일정도 items 길이 1로 표현하고, 아직 모르는 값은 null로 둬.
정보가 부족하면 한 번에 필요한 내용을 자연스럽게 되물으며 phase를 collecting으로 둬.
날짜, 시간, 제목이 모두 모이면 reply로 요약해서 맞는지 확인하고 phase를 confirming으로 둬.
confirming 제안에 사용자가 명확히 동의하면 create_schedule 함수를 호출해. 함수 호출 없이 completed라고 응답하지 마.
확인 전에는 절대로 저장됐다고 말하지 마. reply에는 사용자에게 보여줄 햄스터의 말만 넣어.`

const cancellationInstruction = `현재 사용자의 한국어 메시지 의도를 정확히 하나로 분류해.
대화 기록보다 현재 사용자 메시지의 의도를 우선해.
cancel: 현재 진행 중인 새 일정 만들기 대화 자체를 중단. 예: "취소", "그만할래", "됐어", "안 만들래".
delete: 이미 저장된 특정 일정을 삭제·지우기·없애기. 예: "회의 일정 삭제해줘", "내일 약속 취소해줘", "치과 일정 지워줘".
move: 이미 저장된 특정 일정의 날짜나 시간을 옮기기·변경하기. 예: "병원 일정을 금요일로 옮겨줘", "회의를 3시로 변경해줘".
list: 저장된 일정을 알려달라거나 보여달라는 조회. 예: "현재 일정 다 말해줘", "내일 일정 알려줘", "이번 주 일정 뭐 있어?", "병원 일정 있어?".
create: 새 일정을 추가·등록·잡아달라는 요청, 새 일정의 부족한 정보를 보충하는 답변, 새 일정 확인에 대한 동의. 예: "내일 3시 회의 추가해줘", "운동", "응 맞아".
continue: 취소 부정이나 일정 의도가 아닌 나머지. 예: "취소하지 마", "계속해".
scope도 판정해. "회의 삭제"처럼 제목만 있고 여러 개일 수 있는 요청은 single이야. "모든 일정 삭제", "일정 전부 삭제"는 batch_all이야. "7월과 8월 일정 다 삭제", "이번 주 일정 모두 삭제"는 batch_range야. 한 메시지에 여러 새 일정이 나열되면 batch_multiple이야.
이전 assistant 응답의 intent가 delete 또는 move이고 사용자가 후보를 선택하거나 부족한 대상 정보를 보충하면 이전 intent를 그대로 유지해. 이전 intent가 create이고 사용자가 제목·날짜·시간을 보충하거나 확인하면 create를 유지해.
한국어 부정어와 특정 기존 일정 목적어가 있는지 주의해. cancel이면 reply에 햄스터가 대화 취소를 확인하는 친근한 반말 한 문장을 쓰고, 나머지는 reply를 빈 문자열로 둬.`

const readGeminiResponse = async (response: Response): Promise<GeminiResponse> => {
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    if (
      response.status === 401 ||
      response.status === 403 ||
      /API_KEY_INVALID|API key not valid|invalid api key/iu.test(errorBody)
    ) {
      throw new Error('[GEMINI_KEY_INVALID] Gemini API 키 인증에 실패했습니다.')
    }
    throw new Error(`Gemini API 오류: ${response.status}`)
  }
  const body = (await response.json()) as GeminiResponse
  console.log('[schedule:conversation] Gemini response received', {
    partTypes:
      body.candidates?.[0]?.content?.parts?.map((part) =>
        part.functionCall ? 'functionCall' : part.text ? 'text' : 'other'
      ) ?? [],
    usage: body.usageMetadata
      ? {
          inputTokens: body.usageMetadata.promptTokenCount,
          outputTokens: body.usageMetadata.candidatesTokenCount,
          totalTokens: body.usageMetadata.totalTokenCount
        }
      : undefined
  })
  return body
}

const candidateText = (body: GeminiResponse): string => {
  const text = body.candidates?.[0]?.content?.parts?.find(
    (part) => typeof part.text === 'string'
  )?.text
  if (!text) throw new Error('Gemini 응답이 비어 있습니다.')
  return text
}

const detectIntent = async (
  message: string,
  history: ScheduleConversationRequest['history'],
  apiKey: string,
  signal: AbortSignal
): Promise<{
  intent: 'cancel' | 'create' | 'list' | 'delete' | 'move' | 'continue'
  reply: string
  scope: 'single' | 'batch_all' | 'batch_range' | 'batch_multiple'
}> => {
  const response = await fetchGeminiQueued(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: cancellationInstruction }] },
        contents: [
          ...history.map((turn) => ({
            role: turn.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: turn.text }]
          })),
          { role: 'user', parts: [{ text: message }] }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: cancellationSchema
        }
      })
    }
  )
  const value = JSON.parse(candidateText(await readGeminiResponse(response))) as unknown
  if (typeof value !== 'object' || value === null) {
    throw new Error('취소 판정 응답이 올바르지 않습니다.')
  }
  const result = value as Record<string, unknown>
  if (
    !['cancel', 'create', 'list', 'delete', 'move', 'continue'].includes(
      String(result.intent)
    ) ||
    typeof result.reply !== 'string' ||
    !['single', 'batch_all', 'batch_range', 'batch_multiple'].includes(
      String(result.scope)
    )
  ) {
    throw new Error('취소 판정 응답 스키마가 올바르지 않습니다.')
  }
  const intent = result.intent as
    | 'cancel'
    | 'create'
    | 'list'
    | 'delete'
    | 'move'
    | 'continue'
  const reply = result.reply.trim()
  if (intent === 'cancel' && !reply) {
    throw new Error('취소 응답 문장이 비어 있습니다.')
  }
  return {
    intent,
    reply,
    scope: result.scope as
      | 'single'
      | 'batch_all'
      | 'batch_range'
      | 'batch_multiple'
  }
}

const parseResponse = (value: unknown): ScheduleConversationResponse => {
  if (typeof value !== 'object' || value === null) throw new Error('응답이 객체가 아닙니다.')
  const result = value as Record<string, unknown>
  const items = Array.isArray(result.items) ? result.items : null
  if (
    !SCHEDULE_CONVERSATION_INTENTS.includes(
      result.intent as ScheduleConversationResponse['intent']
    ) ||
    !SCHEDULE_CONVERSATION_PHASES.includes(
      result.phase as ScheduleConversationResponse['phase']
    ) ||
    items === null ||
    items.length > 200 ||
    !items.every((item) => {
      if (typeof item !== 'object' || item === null) return false
      const record = item as Record<string, unknown>
      return (
        (record.title === null || typeof record.title === 'string') &&
        (record.date === null ||
          (typeof record.date === 'string' && DATE_PATTERN.test(record.date))) &&
        (record.time === null ||
          (typeof record.time === 'string' && TIME_PATTERN.test(record.time))) &&
        (record.eventId === null || typeof record.eventId === 'string')
      )
    }) ||
    typeof result.reply !== 'string' ||
    result.reply.trim().length === 0
  ) {
    throw new Error('Gemini 응답 스키마가 올바르지 않습니다.')
  }
  return {
    intent: result.intent as ScheduleConversationResponse['intent'],
    phase: result.phase as ScheduleConversationResponse['phase'],
    items: items.map((item) => {
      const record = item as Record<string, string | null>
      return {
        title: record.title?.trim() || null,
        date: record.date,
        time: record.time,
        eventId: record.eventId
      }
    }),
    reply: result.reply.trim()
  }
}

export const converseAboutSchedule = async (
  request: ScheduleConversationRequest,
  tools: ScheduleToolContext
): Promise<ScheduleConversationResponse> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)
  try {
    const apiKey = getGeminiApiKey()
    const intent = await detectIntent(
      request.message,
      request.history,
      apiKey,
      controller.signal
    )
    console.log('[schedule:conversation] intent detected', {
      intent: intent.intent,
      scope: intent.scope
    })
    if (intent.intent === 'cancel') {
      console.log('[schedule:conversation] response cancelled', {
        intent: 'cancel_conversation',
        phase: 'cancelled'
      })
      return {
        intent: 'cancel_conversation',
        phase: 'cancelled',
        items: [],
        reply: intent.reply
      }
    }
    const instruction = systemInstruction(new Date())
    const previousAssistantState = (() => {
      const previous = [...request.history]
        .reverse()
        .find((turn) => turn.role === 'assistant')
      if (!previous) return null
      try {
        return JSON.parse(previous.text) as Record<string, unknown>
      } catch {
        return null
      }
    })()
    const shouldExecuteCreate =
      intent.intent === 'create' &&
      previousAssistantState?.phase === 'confirming'
    const previousItems = Array.isArray(previousAssistantState?.items)
      ? previousAssistantState.items
      : []
    const shouldExecuteBatchCreate =
      shouldExecuteCreate && previousItems.length > 1
    const shouldExecuteBatchDelete =
      intent.intent === 'delete' &&
      previousAssistantState?.intent === 'delete' &&
      previousAssistantState?.phase === 'confirming' &&
      previousItems.length > 0
    const contents: GeminiContent[] = [
      ...request.history.map((turn) => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.text }]
      })),
      { role: 'user', parts: [{ text: request.message }] }
    ]
    const executedTools: string[] = []
    for (
      let iteration = 1;
      iteration <= MAX_FUNCTION_CALL_ITERATIONS;
      iteration += 1
    ) {
      const lastTool = executedTools.at(-1)
      const mutationCompleted = executedTools.some((name) =>
        [
          'create_schedule',
          'create_schedules',
          'delete_schedule',
          'delete_schedules',
          'delete_schedules_by_range',
          'move_schedule'
        ].includes(name)
      )
      const functionCallingConfig =
        executedTools.length === 0 && shouldExecuteBatchDelete
          ? {
              mode: 'ANY',
              allowedFunctionNames: [
                'delete_schedules',
                'delete_schedules_by_range'
              ]
            }
          : executedTools.length === 0 &&
        ['list', 'delete', 'move'].includes(intent.intent)
          ? {
              mode: 'ANY',
              allowedFunctionNames: ['list_schedules']
            }
          : executedTools.length === 0 && shouldExecuteBatchCreate
            ? {
                mode: 'ANY',
                allowedFunctionNames: ['create_schedules']
              }
            : executedTools.length === 0 && shouldExecuteCreate
            ? {
                mode: 'ANY',
                allowedFunctionNames: ['create_schedule']
              }
            : lastTool === 'list_schedules' &&
                intent.intent === 'delete' &&
                intent.scope === 'single'
              ? {
                  mode: 'VALIDATED',
                  allowedFunctionNames: ['delete_schedule']
                }
              : lastTool === 'list_schedules' && intent.intent === 'move'
                ? {
                    mode: 'VALIDATED',
                    allowedFunctionNames: ['move_schedule']
                  }
                : { mode: 'NONE' }
      const forcesFunction = functionCallingConfig.mode === 'ANY'
      const response = await fetchGeminiQueued(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: `${instruction}\n현재 tool 실행 기록: ${executedTools.join(', ') || '없음'}. 실제 변경 tool이 성공한 뒤에만 phase를 completed로 둬.`
                }
              ]
            },
            contents,
            tools: scheduleTools,
            toolConfig: { functionCallingConfig },
            ...(forcesFunction
              ? {}
              : {
                  generationConfig: {
                    responseMimeType: 'application/json',
                    responseSchema:
                      mutationCompleted ||
                      (intent.intent === 'list' &&
                        executedTools.includes('list_schedules'))
                        ? responseSchema
                        : initialResponseSchema
                  }
                })
          })
        }
      )
      const body = await readGeminiResponse(response)
      const modelContent = body.candidates?.[0]?.content
      const functionCall = modelContent?.parts?.find(
        (part) => part.functionCall !== undefined
      )?.functionCall

      if (!functionCall) {
        const result = parseResponse(JSON.parse(candidateText(body)) as unknown)
        const completedIntent: ScheduleConversationResponse['intent'] | null =
          executedTools.includes('create_schedule')
            ? 'create'
            : executedTools.includes('create_schedules')
              ? 'create'
            : executedTools.includes('delete_schedule')
              ? 'delete'
              : executedTools.includes('delete_schedules') ||
                  executedTools.includes('delete_schedules_by_range')
                ? 'delete'
              : executedTools.includes('move_schedule')
                ? 'move'
                : intent.intent === 'list' &&
                    executedTools.includes('list_schedules')
                  ? 'list'
                  : null
        if (completedIntent) {
          const completed = {
            ...result,
            intent: completedIntent,
            phase: 'completed' as const
          }
          console.log('[schedule:conversation] response completed', {
            intent: completed.intent,
            phase: completed.phase,
            tools: executedTools
          })
          return completed
        }
        if (result.phase === 'completed' || result.phase === 'executing') {
          throw new Error('변경 함수 호출 없이 완료를 응답했습니다.')
        }
        console.log('[schedule:conversation] response pending', {
          intent: result.intent,
          phase: result.phase,
          tools: executedTools
        })
        return result
      }

      const name = functionCall.name
      const args = functionCall.args ?? {}
      console.log('[schedule:conversation] function call', {
        iteration,
        phase: 'executing',
        name,
        args
      })
      let toolResult: Record<string, unknown>
      let updatedSchedules: Schedule[] | null = null
      if (name === 'list_schedules') {
        const schedules = tools.listSchedules(
          args.dateFrom,
          args.dateTo,
          args.query
        )
        toolResult = {
          success: true,
          schedules: schedules.map((schedule) => ({
            eventId: String(schedule.id),
            title: schedule.title,
            startAt: schedule.startAt,
            status: schedule.status
          }))
        }
      } else if (name === 'create_schedule') {
        updatedSchedules = tools.createSchedule(
          args.title,
          args.date,
          args.time
        )
        toolResult = {
          success: true,
          title: String(args.title),
          date: String(args.date),
          time: String(args.time),
          scheduleCount: updatedSchedules.length
        }
      } else if (name === 'create_schedules') {
        const result = tools.createSchedules(args.schedules)
        updatedSchedules = result.schedules
        toolResult = {
          success: true,
          createdCount: result.affected.length,
          created: result.affected.map(({ id, title, startAt }) => ({
            eventId: String(id),
            title,
            startAt
          }))
        }
      } else if (name === 'delete_schedule') {
        updatedSchedules = tools.deleteSchedule(args.eventId)
        toolResult = {
          success: true,
          eventId: String(args.eventId),
          remainingScheduleCount: updatedSchedules.length
        }
      } else if (name === 'delete_schedules') {
        const result = tools.deleteSchedules(args.eventIds)
        updatedSchedules = result.schedules
        toolResult = {
          success: true,
          deletedCount: result.affected.length,
          deleted: result.affected.map(({ id, title, startAt }) => ({
            eventId: String(id),
            title,
            startAt
          }))
        }
      } else if (name === 'delete_schedules_by_range') {
        const result = tools.deleteSchedulesByRange(
          args.dateFrom,
          args.dateTo,
          args.query
        )
        updatedSchedules = result.schedules
        toolResult = {
          success: true,
          deletedCount: result.affected.length,
          deleted: result.affected.map(({ id, title, startAt }) => ({
            eventId: String(id),
            title,
            startAt
          }))
        }
      } else if (name === 'move_schedule') {
        updatedSchedules = tools.moveSchedule(
          args.eventId,
          args.newDate,
          args.newTime
        )
        toolResult = {
          success: true,
          eventId: String(args.eventId),
          remainingScheduleCount: updatedSchedules.length
        }
      } else {
        throw new Error('지원하지 않는 일정 함수입니다.')
      }
      if (updatedSchedules) {
        tools.schedulesChanged(updatedSchedules)
      }
      executedTools.push(String(name))
      if (!modelContent) throw new Error('함수 호출 content가 비어 있습니다.')
      contents.push(modelContent, {
        role: 'user',
        parts: [
          {
            functionResponse: {
              id: functionCall.id,
              name,
              response: toolResult
            }
          }
        ]
      })
    }
    throw new Error('일정 함수 호출 횟수가 제한을 초과했습니다.')
  } finally {
    clearTimeout(timeout)
  }
}
