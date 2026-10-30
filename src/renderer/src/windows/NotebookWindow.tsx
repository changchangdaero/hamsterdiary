// 할 일·일기·계획 탭을 한 창 안에서 전환하는 노트 창입니다.
import { useEffect, useState } from 'react'
import {
  NOTEBOOK_VIEWS,
  type NotebookView
} from '../../../shared/types/notebook'
import { PET_FRAME_IMAGES } from '../petAssets'
import { DATE_KEY_PATTERN, toDateKey } from '../dateKey'
import TodoView from '../views/TodoView'
import DiaryView from '../views/DiaryView'
import PlanView from '../views/PlanView'

const HEADERS: Record<NotebookView, { kicker: string; title: string; image: string; alt: string }> = {
  todos: {
    kicker: 'HAMSTER TODO',
    title: '같이 해낼 할 일',
    image: PET_FRAME_IMAGES['thumbs-up'],
    alt: '응원하는 햄이'
  },
  diary: {
    kicker: 'HAMSTER DIARY',
    title: '하루 한 장 일기',
    image: PET_FRAME_IMAGES.happy,
    alt: '일기를 응원하는 햄이'
  },
  plan: {
    kicker: 'DAILY PLAN',
    title: '하루 계획 노트',
    image: PET_FRAME_IMAGES.happy,
    alt: '계획을 응원하는 햄이'
  }
}

const TAB_LABELS: Record<NotebookView, string> = {
  todos: '할 일',
  diary: '일기',
  plan: '계획'
}

const isNotebookView = (value: unknown): value is NotebookView =>
  NOTEBOOK_VIEWS.includes(value as NotebookView)

function NotebookWindow(): React.JSX.Element {
  const params = new URLSearchParams(window.location.search)
  const requestedView = params.get('view')
  const requestedDate = params.get('date')
  const [view, setView] = useState<NotebookView>(
    isNotebookView(requestedView) ? requestedView : 'plan'
  )
  // Diary and plan share one selected date so switching tabs keeps the same day.
  const [date, setDate] = useState(
    requestedDate && DATE_KEY_PATTERN.test(requestedDate)
      ? requestedDate
      : toDateKey(new Date())
  )

  const changeDate = (nextDate: string): void => {
    if (DATE_KEY_PATTERN.test(nextDate)) setDate(nextDate)
  }

  useEffect(
    () =>
      window.desktopPetAPI.onNotebookViewRequested((request) => {
        if (isNotebookView(request.view)) setView(request.view)
        if (request.date && DATE_KEY_PATTERN.test(request.date)) setDate(request.date)
      }),
    []
  )

  useEffect(() => {
    document.title = `Hami - ${TAB_LABELS[view]}`
  }, [view])

  const header = HEADERS[view]

  return (
    <main className={`notebook-shell is-${view}`}>
      <header className="diary-header notebook-header">
        <div>
          <p className="pixel-kicker">{header.kicker}</p>
          <h1>{header.title}</h1>
          <nav className="todo-tabs" aria-label="일정, 할 일, 일기, 계획 화면">
            <button type="button" onClick={() => void window.desktopPetAPI.openScheduleDiary()}>
              일정
            </button>
            {NOTEBOOK_VIEWS.map((tab) =>
              tab === view ? (
                <span key={tab} aria-current="page">{TAB_LABELS[tab]}</span>
              ) : (
                <button key={tab} type="button" onClick={() => setView(tab)}>
                  {TAB_LABELS[tab]}
                </button>
              )
            )}
          </nav>
        </div>
        <img src={header.image} alt={header.alt} />
      </header>

      <div className="notebook-body">
        {view === 'todos' && <TodoView />}
        {view === 'diary' && <DiaryView date={date} onDateChange={changeDate} />}
        {view === 'plan' && <PlanView date={date} onDateChange={changeDate} />}
      </div>

      <button
        type="button"
        className="todo-close"
        onClick={() => void window.desktopPetAPI.closeNotebook()}
      >
        창 닫기
      </button>
    </main>
  )
}

export default NotebookWindow
