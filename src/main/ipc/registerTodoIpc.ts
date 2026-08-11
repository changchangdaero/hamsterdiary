import { randomUUID } from 'node:crypto'
import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import type {
  SetTodoDonePayload,
  Todo,
  TodoMutationResult
} from '../../shared/types/todo'
import { todosStore } from '../stores'

interface Options {
  getTrustedWindows: () => Array<BrowserWindow | null>
  todosChanged: (todos: Todo[]) => void
  todoCompleted: (allDone: boolean) => void
  openTodos: () => void
  closeTodos: () => void
}

const sortedTodos = (): Todo[] =>
  [...todosStore.get('todos')].sort((left, right) =>
    left.done === right.done
      ? left.createdAt.localeCompare(right.createdAt)
      : Number(left.done) - Number(right.done)
  )

const writeTodos = (todos: Todo[]): Todo[] => {
  todosStore.set('todos', todos)
  return sortedTodos()
}

const parseText = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('할 일 내용이 필요합니다.')
  const text = value.trim()
  if (text.length < 1 || text.length > 200) {
    throw new Error('할 일은 1~200자로 입력해 주세요.')
  }
  return text
}

const parseId = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > 100) {
    throw new Error('할 일 식별자가 올바르지 않습니다.')
  }
  return value.trim()
}

export const listStoredTodos = (): Todo[] => sortedTodos()

export const createStoredTodo = (value: unknown): TodoMutationResult => {
  const todo: Todo = {
    id: randomUUID(),
    text: parseText(value),
    done: false,
    createdAt: new Date().toISOString()
  }
  const todos = writeTodos([...todosStore.get('todos'), todo])
  console.log('[todo:create] store changed', { todoId: todo.id })
  return { todos, changed: todo, allDone: false }
}

export const setStoredTodoDone = (
  idValue: unknown,
  doneValue: unknown
): TodoMutationResult => {
  const id = parseId(idValue)
  if (typeof doneValue !== 'boolean') throw new Error('완료 상태가 올바르지 않습니다.')
  let changed: Todo | null = null
  const current = todosStore.get('todos')
  const updated = current.map((todo) => {
    if (String(todo.id) !== String(id)) return todo
    changed = { ...todo, done: doneValue }
    return changed
  })
  if (!changed) throw new Error('해당 할 일을 찾지 못했습니다.')
  const todos = writeTodos(updated)
  const allDone = todos.length > 0 && todos.every((todo) => todo.done)
  console.log('[todo:complete] store changed', { todoId: id, done: doneValue, allDone })
  return { todos, changed, allDone }
}

export const deleteStoredTodo = (idValue: unknown): TodoMutationResult => {
  const id = parseId(idValue)
  const current = todosStore.get('todos')
  const changed = current.find((todo) => String(todo.id) === String(id)) ?? null
  if (!changed) throw new Error('해당 할 일을 찾지 못했습니다.')
  const todos = writeTodos(
    current.filter((todo) => String(todo.id) !== String(id))
  )
  console.log('[todo:delete] store changed', { todoId: id })
  return { todos, changed, allDone: false }
}

export const registerTodoIpc = (options: Options): (() => void) => {
  const assertTrusted = (event: IpcMainInvokeEvent): void => {
    const trusted = options.getTrustedWindows().some(
      (window) =>
        window !== null && !window.isDestroyed() && event.sender === window.webContents
    )
    if (!trusted) throw new Error('허용되지 않은 할 일 요청입니다.')
  }
  const respond = (result: TodoMutationResult, react = false): Todo[] => {
    options.todosChanged(result.todos)
    if (react && result.changed?.done) options.todoCompleted(result.allDone)
    return result.todos
  }

  ipcMain.handle(IPC_CHANNELS.listTodos, (event) => {
    assertTrusted(event)
    return listStoredTodos()
  })
  ipcMain.handle(IPC_CHANNELS.createTodo, (event, text: unknown) => {
    assertTrusted(event)
    return respond(createStoredTodo(text))
  })
  ipcMain.handle(IPC_CHANNELS.setTodoDone, (event, payload: unknown) => {
    assertTrusted(event)
    if (typeof payload !== 'object' || payload === null) {
      throw new Error('완료 요청이 올바르지 않습니다.')
    }
    const value = payload as Partial<SetTodoDonePayload>
    return respond(setStoredTodoDone(value.id, value.done), true)
  })
  ipcMain.handle(IPC_CHANNELS.deleteTodo, (event, id: unknown) => {
    assertTrusted(event)
    return respond(deleteStoredTodo(id))
  })
  ipcMain.handle(IPC_CHANNELS.openTodos, (event) => {
    assertTrusted(event)
    options.openTodos()
  })
  ipcMain.handle(IPC_CHANNELS.closeTodos, (event) => {
    assertTrusted(event)
    options.closeTodos()
  })

  return () => {
    for (const channel of [
      IPC_CHANNELS.listTodos,
      IPC_CHANNELS.createTodo,
      IPC_CHANNELS.setTodoDone,
      IPC_CHANNELS.deleteTodo,
      IPC_CHANNELS.openTodos,
      IPC_CHANNELS.closeTodos
    ]) ipcMain.removeHandler(channel)
  }
}

