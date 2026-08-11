import type {
  Todo,
  TodoConversationRequest,
  TodoConversationResponse,
  TodoMutationResult
} from '../../shared/types/todo'
import { fetchGeminiQueued } from './geminiRequestQueue'
import { getGeminiApiKey } from './geminiKeyService'

const GEMINI_MODEL = 'gemini-3.5-flash-lite'
const MAX_ITERATIONS = 3
const TIMEOUT_MS = 75_000

interface GeminiPart {
  text?: string
  functionCall?: { name?: string; args?: Record<string, unknown> }
  functionResponse?: unknown
}

interface GeminiContent {
  role: string
  parts: GeminiPart[]
}

interface GeminiResponse {
  candidates?: Array<{ content?: GeminiContent }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
}

export interface TodoToolContext {
  listTodos: () => Todo[]
  addTodo: (text: unknown) => TodoMutationResult
  completeTodo: (todoId: unknown) => TodoMutationResult
  deleteTodo: (todoId: unknown) => TodoMutationResult
  todosChanged: (todos: Todo[]) => void
  todoCompleted: (allDone: boolean) => void
}

const tools = [
  {
    functionDeclarations: [
      {
        name: 'add_todo',
        description: '새 할 일을 todos store에 추가한다.',
        parameters: {
          type: 'OBJECT',
          properties: { text: { type: 'STRING', description: '추가할 할 일 내용' } },
          required: ['text']
        }
      },
      {
        name: 'list_todos',
        description: '실제 todos store의 전체 할 일 목록과 ID를 조회한다.',
        parameters: { type: 'OBJECT', properties: {} }
      },
      {
        name: 'complete_todo',
        description: '고유 ID로 할 일을 완료 처리한다.',
        parameters: {
          type: 'OBJECT',
          properties: { todoId: { type: 'STRING' } },
          required: ['todoId']
        }
      },
      {
        name: 'delete_todo',
        description: '고유 ID로 할 일을 삭제한다.',
        parameters: {
          type: 'OBJECT',
          properties: { todoId: { type: 'STRING' } },
          required: ['todoId']
        }
      }
    ]
  }
]

const instruction = `너는 사용자의 할 일을 함께 해내는 친근한 반말 햄스터야.
이 대화는 사용자가 UI에서 이미 "할일" 모드를 선택한 뒤 들어왔어. 일정인지 추측하지 말고 모든 요청을 투두로만 처리해.
날짜나 시간이 문장에 있어도 달력 일정을 만들지 말고 할 일 text에 자연스럽게 포함해.
할 일 추가는 반드시 add_todo, 목록 조회는 list_todos를 호출해.
완료나 삭제 요청은 실제 ID가 필요하므로 먼저 list_todos로 실제 목록을 확인해. 후보가 하나면 그 ID로 complete_todo 또는 delete_todo를 호출하고, 여러 후보면 짧게 되물어.
tool 성공 전에는 추가·완료·삭제했다고 말하지 마. tool 결과만 근거로 답해.
답변은 짧고 친근한 반말로 하고 과한 이모지는 쓰지 마.`

const readResponse = async (response: Response): Promise<GeminiResponse> => {
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    if (
      response.status === 401 ||
      response.status === 403 ||
      /API_KEY_INVALID|API key not valid|invalid api key/iu.test(body)
    ) throw new Error('[GEMINI_KEY_INVALID] Gemini API 키 인증에 실패했습니다.')
    throw new Error(`Gemini API 오류: ${response.status}`)
  }
  const body = (await response.json()) as GeminiResponse
  console.log('[todo:conversation] Gemini response received', {
    partTypes:
      body.candidates?.[0]?.content?.parts.map((part) =>
        part.functionCall ? 'functionCall' : part.text ? 'text' : 'other'
      ) ?? [],
    usage: body.usageMetadata
  })
  return body
}

export const converseAboutTodo = async (
  request: TodoConversationRequest,
  context: TodoToolContext
): Promise<TodoConversationResponse> => {
  const apiKey = getGeminiApiKey()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const contents: GeminiContent[] = [
    ...request.history.map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.text }]
    })),
    { role: 'user', parts: [{ text: request.message }] }
  ]
  let mutationCompleted = false

  try {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
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
            systemInstruction: { parts: [{ text: instruction }] },
            contents,
            tools,
            toolConfig: {
              functionCallingConfig: mutationCompleted
                ? { mode: 'NONE' }
                : iteration === 0
                  ? {
                      mode: 'ANY',
                      allowedFunctionNames: ['add_todo', 'list_todos']
                    }
                  : { mode: 'AUTO' }
            }
          })
        }
      )
      const body = await readResponse(response)
      const content = body.candidates?.[0]?.content
      if (!content) throw new Error('Gemini 응답이 비어 있습니다.')
      const call = content.parts.find((part) => part.functionCall)?.functionCall
      if (!call?.name) {
        const reply = content.parts.find((part) => part.text)?.text?.trim()
        if (!reply) throw new Error('할 일 응답이 비어 있습니다.')
        return { reply, completed: mutationCompleted }
      }

      const args = call.args ?? {}
      let result: unknown
      if (call.name === 'list_todos') {
        result = context.listTodos()
      } else if (call.name === 'add_todo') {
        const mutation = context.addTodo(args.text)
        context.todosChanged(mutation.todos)
        mutationCompleted = true
        result = mutation
      } else if (call.name === 'complete_todo') {
        const mutation = context.completeTodo(args.todoId)
        context.todosChanged(mutation.todos)
        if (mutation.changed?.done) context.todoCompleted(mutation.allDone)
        mutationCompleted = true
        result = mutation
      } else if (call.name === 'delete_todo') {
        const mutation = context.deleteTodo(args.todoId)
        context.todosChanged(mutation.todos)
        mutationCompleted = true
        result = mutation
      } else {
        throw new Error(`지원하지 않는 할 일 함수입니다: ${call.name}`)
      }
      console.log('[todo:conversation] function executed', { name: call.name })
      contents.push(content)
      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: call.name,
              response: { result }
            }
          }
        ]
      })
    }
    throw new Error('할 일 대화 함수 호출 한도를 초과했습니다.')
  } finally {
    clearTimeout(timeout)
  }
}
