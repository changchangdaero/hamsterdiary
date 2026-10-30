// OS 전체 입력이 일정 시간 없으면 '자리 비움'으로 보고, 바뀔 때만 알려주는 서비스입니다.
import { powerMonitor } from 'electron'

// Polled often so the hamster wakes up promptly when the user comes back.
const POLL_INTERVAL_MS = 2_000

export interface UserPresenceMonitor {
  isAway: () => boolean
  // The hamster dozes off once there has been no keyboard or mouse input this long.
  setAwaySeconds: (seconds: number) => void
  dispose: () => void
}

export const startUserPresenceMonitor = (
  awaySeconds: number,
  onChange: (away: boolean) => void
): UserPresenceMonitor => {
  let away = false
  let threshold = awaySeconds
  const check = (): void => {
    const state = powerMonitor.getSystemIdleState(threshold)
    const nextAway = state === 'idle' || state === 'locked'
    if (nextAway === away) return
    away = nextAway
    onChange(away)
  }
  const timer = setInterval(check, POLL_INTERVAL_MS)
  timer.unref()

  return {
    isAway: () => away,
    setAwaySeconds: (seconds) => {
      threshold = seconds
      check()
    },
    dispose: () => clearInterval(timer)
  }
}
