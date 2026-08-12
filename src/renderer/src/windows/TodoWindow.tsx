import { useEffect, useMemo, useState } from 'react'
import type { Todo } from '../../../shared/types/todo'
import { PET_FRAME_IMAGES } from '../petAssets'

function TodoWindow(): React.JSX.Element {
  const [todos, setTodos] = useState<Todo[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const unsubscribe = window.desktopPetAPI.onTodosChanged(setTodos)
    void window.desktopPetAPI
      .listTodos()
      .then(setTodos)
      .catch(() => setError('할 일 목록을 불러오지 못했어.'))
    return unsubscribe
  }, [])

  const remaining = useMemo(
    () => todos.filter((todo) => !todo.done).length,
    [todos]
  )

  const add = async (): Promise<void> => {
    const value = text.trim()
    if (!value || saving) return
    setSaving(true)
    setError('')
    try {
      setTodos(await window.desktopPetAPI.createTodo(value))
      setText('')
    } catch {
      setError('할 일을 추가하지 못했어.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="todo-shell">
      <header className="todo-header">
        <div>
          <p className="pixel-kicker">HAMSTER TODO</p>
          <h1>같이 해낼 할 일</h1>
          <p>{todos.length === 0 ? '할 일을 적어보자!' : `${remaining}개 남았어. 같이 해보자!`}</p>
          <nav className="todo-tabs" aria-label="일정과 할 일 화면">
            <button type="button" onClick={() => void window.desktopPetAPI.openScheduleDiary()}>
              일정
            </button>
            <span aria-current="page">할일</span>
            <button type="button" onClick={() => void window.desktopPetAPI.openDiary()}>
              일기
            </button>
          </nav>
        </div>
        <img src={PET_FRAME_IMAGES['thumbs-up']} alt="응원하는 햄스터" />
      </header>

      <section className="todo-panel">
        <form
          className="todo-add-form"
          onSubmit={(event) => {
            event.preventDefault()
            void add()
          }}
        >
          <label htmlFor="new-todo" className="sr-only">새 할 일</label>
          <input
            id="new-todo"
            value={text}
            maxLength={200}
            placeholder="할 일을 직접 적어줘…"
            onChange={(event) => setText(event.target.value)}
          />
          <button type="submit" disabled={saving || text.trim().length === 0}>
            추가
          </button>
        </form>

        {error && <p className="todo-error" role="alert">{error}</p>}
        {todos.length === 0 ? (
          <div className="todo-empty">아직 할 일이 없어. 우유 사기처럼 편하게 적어봐!</div>
        ) : (
          <ul className="todo-list">
            {todos.map((todo) => (
              <li key={todo.id} className={todo.done ? 'is-done' : ''}>
                <label>
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={(event) => {
                      void window.desktopPetAPI
                        .setTodoDone({ id: todo.id, done: event.target.checked })
                        .then(setTodos)
                        .catch(() => setError('완료 상태를 바꾸지 못했어.'))
                    }}
                  />
                  <span>{todo.text}</span>
                </label>
                <button
                  type="button"
                  className="danger"
                  aria-label={`${todo.text} 삭제`}
                  onClick={() => {
                    void window.desktopPetAPI
                      .deleteTodo(todo.id)
                      .then(setTodos)
                      .catch(() => setError('할 일을 삭제하지 못했어.'))
                  }}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <button type="button" className="todo-close" onClick={() => void window.desktopPetAPI.closeTodos()}>
        할 일 닫기
      </button>
    </main>
  )
}

export default TodoWindow
