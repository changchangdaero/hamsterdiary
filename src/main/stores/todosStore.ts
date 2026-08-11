import Store from 'electron-store'
import type { TodosStoreData } from '../../shared/types/stores'

export const todosStore = new Store<TodosStoreData>({
  name: 'todos',
  defaults: {
    dataVersion: 1,
    todos: []
  }
})

