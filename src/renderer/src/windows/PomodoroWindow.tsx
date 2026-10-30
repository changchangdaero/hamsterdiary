import { useEffect, useState } from 'react'
import {
  DEFAULT_POMODORO_SETTINGS,
  type PomodoroState
} from '../../../shared/types/pomodoro'
import { PET_FRAME_IMAGES } from '../petAssets'

const INITIAL_STATE: PomodoroState = {
  mode: 'focus',
  runState: 'idle',
  remainingSeconds: DEFAULT_POMODORO_SETTINGS.focusMinutes * 60,
  durationSeconds: DEFAULT_POMODORO_SETTINGS.focusMinutes * 60,
  endAt: null
}

const formatTime = (seconds: number): string => {
  const safe = Math.max(0, seconds)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

function PomodoroWindow(): React.JSX.Element {
  const [state, setState] = useState<PomodoroState>(INITIAL_STATE)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribe = window.desktopPetAPI.onPomodoroChanged(setState)
    void window.desktopPetAPI
      .getPomodoroState()
      .then(setState)
      .catch(() => setError('타이머 상태를 불러오지 못했어.'))
    return unsubscribe
  }, [])

  const run = async (
    action: 'start' | 'pause' | 'reset'
  ): Promise<void> => {
    setError('')
    try {
      const next =
        action === 'start'
          ? await window.desktopPetAPI.startPomodoro()
          : action === 'pause'
            ? await window.desktopPetAPI.pausePomodoro()
            : await window.desktopPetAPI.resetPomodoro()
      setState(next)
    } catch {
      setError('타이머를 조작하지 못했어. 다시 시도해줘.')
    }
  }

  const petFrame =
    state.runState !== 'running'
      ? 'idle'
      : state.mode === 'focus'
        ? 'talking'
        : 'sleep'

  return (
    <main className={`pomodoro-shell is-${state.mode}`}>
      <header>
        <p className="pixel-kicker">FOCUS WITH HAMSTER</p>
        <h1>같이 집중 타이머</h1>
      </header>
      <section className="pomodoro-card">
        <div className="pomodoro-mode">
          {state.mode === 'focus' ? '집중 시간' : '쉬는 시간'}
        </div>
        <img
          className="pomodoro-pet"
          src={PET_FRAME_IMAGES[petFrame]}
          alt={state.mode === 'focus' ? '함께 집중하는 햄이' : '쉬는 햄이'}
        />
        <output className="pomodoro-time" aria-live="off">
          {formatTime(state.remainingSeconds)}
        </output>
        <p className="pomodoro-caption">
          {state.runState === 'running'
            ? state.mode === 'focus'
              ? '나도 옆에서 열심히 집중 중이야!'
              : '잠깐 쉬면서 다음 집중을 준비하자~'
            : state.runState === 'paused'
              ? '잠깐 멈췄어. 준비되면 다시 가자.'
              : '준비되면 같이 시작하자!'}
        </p>
        <div className="pomodoro-controls">
          {state.runState === 'running' ? (
            <button type="button" onClick={() => void run('pause')}>일시정지</button>
          ) : (
            <button type="button" onClick={() => void run('start')}>
              {state.runState === 'paused' ? '계속하기' : '시작'}
            </button>
          )}
          <button type="button" className="secondary" onClick={() => void run('reset')}>
            리셋
          </button>
        </div>
        {error && <p className="pomodoro-error" role="alert">{error}</p>}
      </section>
      <footer>
        <button type="button" className="text-button" onClick={() => void window.desktopPetAPI.openSettings('focus')}>
          집중·휴식 시간 설정
        </button>
        <button type="button" className="text-button" onClick={() => void window.desktopPetAPI.closePomodoro()}>
          닫기
        </button>
      </footer>
    </main>
  )
}

export default PomodoroWindow
