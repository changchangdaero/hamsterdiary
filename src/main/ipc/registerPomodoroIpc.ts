import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import type { PomodoroTimerService } from '../services/pomodoroTimerService'

interface Options {
  getTrustedWindows: () => Array<BrowserWindow | null>
  timer: PomodoroTimerService
  openPomodoro: () => void
  closePomodoro: () => void
}

export const registerPomodoroIpc = (options: Options): (() => void) => {
  const assertTrusted = (event: IpcMainInvokeEvent): void => {
    const trusted = options.getTrustedWindows().some(
      (window) =>
        window !== null && !window.isDestroyed() && event.sender === window.webContents
    )
    if (!trusted) throw new Error('허용되지 않은 뽀모도로 요청입니다.')
  }
  const handle = (channel: string, action: (value?: unknown) => unknown): void => {
    ipcMain.handle(channel, (event, value: unknown) => {
      assertTrusted(event)
      return action(value)
    })
  }

  handle(IPC_CHANNELS.getPomodoroState, () => options.timer.getState())
  handle(IPC_CHANNELS.startPomodoro, () => options.timer.start())
  handle(IPC_CHANNELS.pausePomodoro, () => options.timer.pause())
  handle(IPC_CHANNELS.resetPomodoro, () => options.timer.reset())
  handle(IPC_CHANNELS.getPomodoroSettings, () => options.timer.getSettings())
  handle(IPC_CHANNELS.updatePomodoroSettings, (value) =>
    options.timer.updateSettings(value)
  )
  handle(IPC_CHANNELS.openPomodoro, () => options.openPomodoro())
  handle(IPC_CHANNELS.closePomodoro, () => options.closePomodoro())

  return () => {
    for (const channel of [
      IPC_CHANNELS.getPomodoroState,
      IPC_CHANNELS.startPomodoro,
      IPC_CHANNELS.pausePomodoro,
      IPC_CHANNELS.resetPomodoro,
      IPC_CHANNELS.getPomodoroSettings,
      IPC_CHANNELS.updatePomodoroSettings,
      IPC_CHANNELS.openPomodoro,
      IPC_CHANNELS.closePomodoro
    ]) {
      ipcMain.removeHandler(channel)
    }
  }
}
