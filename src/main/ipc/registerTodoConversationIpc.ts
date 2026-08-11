import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import type { Todo, TodoConversationRequest } from '../../shared/types/todo'
import { converseAboutTodo } from '../services/geminiTodoConversation'
import {
  createStoredTodo,
  deleteStoredTodo,
  listStoredTodos,
  setStoredTodoDone
} from './registerTodoIpc'

interface Options {
  getPetWindow: () => BrowserWindow | null
  todosChanged: (todos: Todo[]) => void
  todoCompleted: (allDone: boolean) => void
}

const validateRequest = (value: unknown): TodoConversationRequest => {
  if (typeof value !== 'object' || value === null) throw new Error('대화 요청이 올바르지 않습니다.')
  const request = value as Record<string, unknown>
  if (
    typeof request.message !== 'string' ||
    request.message.trim().length < 1 ||
    request.message.length > 500 ||
    !Array.isArray(request.history) ||
    request.history.length > 30 ||
    !request.history.every(
      (turn) =>
        typeof turn === 'object' &&
        turn !== null &&
        ((turn as Record<string, unknown>).role === 'user' ||
          (turn as Record<string, unknown>).role === 'assistant') &&
        typeof (turn as Record<string, unknown>).text === 'string'
    )
  ) throw new Error('대화 요청이 올바르지 않습니다.')
  return {
    message: request.message.trim(),
    history: request.history as TodoConversationRequest['history']
  }
}

export const registerTodoConversationIpc = (options: Options): (() => void) => {
  ipcMain.handle(
    IPC_CHANNELS.converseAboutTodo,
    async (event: IpcMainInvokeEvent, value: unknown) => {
      const petWindow = options.getPetWindow()
      if (!petWindow || petWindow.isDestroyed() || event.sender !== petWindow.webContents) {
        throw new Error('허용되지 않은 할 일 대화 요청입니다.')
      }
      return converseAboutTodo(validateRequest(value), {
        listTodos: listStoredTodos,
        addTodo: createStoredTodo,
        completeTodo: (id) => setStoredTodoDone(id, true),
        deleteTodo: deleteStoredTodo,
        todosChanged: options.todosChanged,
        todoCompleted: options.todoCompleted
      })
    }
  )
  return () => ipcMain.removeHandler(IPC_CHANNELS.converseAboutTodo)
}

