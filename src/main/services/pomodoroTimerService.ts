import type {
  PomodoroEvent,
  PomodoroSettings,
  PomodoroState,
  StoredPomodoroState
} from '../../shared/types/pomodoro'
import { runtimeStore, settingsStore } from '../stores'

interface Options {
  stateChanged: (state: PomodoroState) => void
  phaseEvent: (event: PomodoroEvent) => void
  now?: () => Date
}

const secondsFor = (
  mode: PomodoroState['mode'],
  settings: PomodoroSettings
): number =>
  (mode === 'focus' ? settings.focusMinutes : settings.breakMinutes) * 60

const parseSettings = (value: unknown): PomodoroSettings => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('뽀모도로 설정이 올바르지 않습니다.')
  }
  const record = value as Record<string, unknown>
  const focusMinutes = Number(record.focusMinutes)
  const breakMinutes = Number(record.breakMinutes)
  if (
    !Number.isInteger(focusMinutes) ||
    focusMinutes < 1 ||
    focusMinutes > 120 ||
    !Number.isInteger(breakMinutes) ||
    breakMinutes < 1 ||
    breakMinutes > 60
  ) {
    throw new Error('집중은 1~120분, 휴식은 1~60분으로 설정해 주세요.')
  }
  return { focusMinutes, breakMinutes }
}

export class PomodoroTimerService {
  private readonly options: Options
  private readonly now: () => Date
  private timer: ReturnType<typeof setInterval> | null = null
  private state: StoredPomodoroState
  private lastBroadcastSecond = -1

  constructor(options: Options) {
    this.options = options
    this.now = options.now ?? (() => new Date())
    this.state = runtimeStore.get('pomodoro')
    this.normalizeStoredState()
    if (this.state.runState === 'running') {
      this.tick()
      this.startTicker()
    }
  }

  private settings(): PomodoroSettings {
    return settingsStore.get('pomodoro')
  }

  private normalizeStoredState(): void {
    const validMode = this.state?.mode === 'focus' || this.state?.mode === 'break'
    const validRunState = ['idle', 'running', 'paused'].includes(
      this.state?.runState
    )
    if (!validMode || !validRunState || !Number.isFinite(this.state.remainingSeconds)) {
      this.state = {
        mode: 'focus',
        runState: 'idle',
        remainingSeconds: secondsFor('focus', this.settings()),
        endAt: null
      }
      this.persist()
    }
  }

  private remainingNow(): number {
    if (this.state.runState !== 'running' || !this.state.endAt) {
      return Math.max(0, Math.ceil(this.state.remainingSeconds))
    }
    return Math.max(
      0,
      Math.ceil((Date.parse(this.state.endAt) - this.now().getTime()) / 1000)
    )
  }

  private publicState(): PomodoroState {
    return {
      ...this.state,
      remainingSeconds: this.remainingNow(),
      durationSeconds: secondsFor(this.state.mode, this.settings())
    }
  }

  private persist(): void {
    runtimeStore.set('pomodoro', this.state)
  }

  private broadcast(): void {
    this.options.stateChanged(this.publicState())
  }

  private startTicker(): void {
    if (this.timer !== null) return
    this.timer = setInterval(() => this.tick(), 250)
    this.timer.unref()
  }

  private stopTicker(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }

  private transition(): void {
    const completedMode = this.state.mode
    const nextMode = completedMode === 'focus' ? 'break' : 'focus'
    const nextSeconds = secondsFor(nextMode, this.settings())
    this.state = {
      mode: nextMode,
      runState: 'running',
      remainingSeconds: nextSeconds,
      endAt: new Date(this.now().getTime() + nextSeconds * 1000).toISOString()
    }
    this.lastBroadcastSecond = nextSeconds
    this.persist()
    this.broadcast()
    this.options.phaseEvent(
      completedMode === 'focus' ? 'focus-completed' : 'break-completed'
    )
  }

  private tick(): void {
    if (this.state.runState !== 'running') return
    const remaining = this.remainingNow()
    if (remaining <= 0) {
      this.transition()
      return
    }
    if (remaining !== this.lastBroadcastSecond) {
      this.lastBroadcastSecond = remaining
      this.state.remainingSeconds = remaining
      this.persist()
      this.broadcast()
    }
  }

  getState(): PomodoroState {
    return this.publicState()
  }

  getSettings(): PomodoroSettings {
    return { ...this.settings() }
  }

  updateSettings(value: unknown): PomodoroSettings {
    const settings = parseSettings(value)
    settingsStore.set('pomodoro', settings)
    const nextSeconds = secondsFor(this.state.mode, settings)
    this.state = {
      ...this.state,
      remainingSeconds: nextSeconds,
      endAt:
        this.state.runState === 'running'
          ? new Date(this.now().getTime() + nextSeconds * 1000).toISOString()
          : null
    }
    this.lastBroadcastSecond = nextSeconds
    this.persist()
    this.broadcast()
    return settings
  }

  start(): PomodoroState {
    if (this.state.runState === 'running') return this.publicState()
    const remaining = Math.max(
      1,
      this.state.remainingSeconds || secondsFor(this.state.mode, this.settings())
    )
    this.state = {
      ...this.state,
      runState: 'running',
      remainingSeconds: remaining,
      endAt: new Date(this.now().getTime() + remaining * 1000).toISOString()
    }
    this.lastBroadcastSecond = remaining
    this.persist()
    this.startTicker()
    this.broadcast()
    if (this.state.mode === 'focus') this.options.phaseEvent('focus-started')
    return this.publicState()
  }

  pause(): PomodoroState {
    if (this.state.runState !== 'running') return this.publicState()
    this.state = {
      ...this.state,
      runState: 'paused',
      remainingSeconds: this.remainingNow(),
      endAt: null
    }
    this.stopTicker()
    this.persist()
    this.broadcast()
    return this.publicState()
  }

  reset(): PomodoroState {
    this.stopTicker()
    this.state = {
      mode: 'focus',
      runState: 'idle',
      remainingSeconds: secondsFor('focus', this.settings()),
      endAt: null
    }
    this.lastBroadcastSecond = -1
    this.persist()
    this.broadcast()
    return this.publicState()
  }

  dispose(): void {
    this.stopTicker()
  }
}
