export interface Todo {
  id: string
  text: string
  done: boolean
  createdAt: string
}

export interface SetTodoDonePayload {
  id: string
  done: boolean
}

export interface TodoMutationResult {
  todos: Todo[]
  changed: Todo | null
  allDone: boolean
}

export interface TodoConversationRequest {
  message: string
  history: Array<{ role: 'user' | 'assistant'; text: string }>
}

export interface TodoConversationResponse {
  reply: string
  completed: boolean
}

