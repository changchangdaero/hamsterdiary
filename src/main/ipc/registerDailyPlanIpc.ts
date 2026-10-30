import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import type {
  DailyPlan,
  DailyPlanCommentResult,
  SaveDailyPlanPayload
} from '../../shared/types/plan'
import { dailyPlanStore } from '../stores/dailyPlanStore'
import { parseDateKey } from './parseDateKey'

interface Options {
  getTrustedWindows: () => Array<BrowserWindow | null>
  openDailyPlan: (date?: string) => void
  commentOnDailyPlan: (date: string) => Promise<DailyPlanCommentResult>
  dailyPlanChanged: (dates: string[]) => void
}

const MAX_PLAN_LENGTH = 20_000
const planKey = (date: string): string => `plan:${date}`
const listDates = (): string[] =>
  Object.keys(dailyPlanStore.store)
    .filter((key) => key.startsWith('plan:'))
    .map((key) => key.slice('plan:'.length))
    .sort()

export const registerDailyPlanIpc = (options: Options): (() => void) => {
  const assertTrusted = (event: IpcMainInvokeEvent): void => {
    const trusted = options.getTrustedWindows().some(
      (window) =>
        window !== null && !window.isDestroyed() && event.sender === window.webContents
    )
    if (!trusted) throw new Error('허용되지 않은 하루 계획 요청입니다.')
  }

  ipcMain.handle(IPC_CHANNELS.getDailyPlan, (event, rawDate: unknown) => {
    assertTrusted(event)
    const date = parseDateKey(rawDate)
    return dailyPlanStore.get(planKey(date)) ?? null
  })
  ipcMain.handle(IPC_CHANNELS.listDailyPlanDates, (event) => {
    assertTrusted(event)
    return listDates()
  })
  ipcMain.handle(IPC_CHANNELS.saveDailyPlan, (event, rawPayload: unknown) => {
    assertTrusted(event)
    if (typeof rawPayload !== 'object' || rawPayload === null) {
      throw new Error('저장할 계획을 확인해 주세요.')
    }
    const payload = rawPayload as Partial<SaveDailyPlanPayload>
    const date = parseDateKey(payload.date)
    if (typeof payload.text !== 'string' || payload.text.length > MAX_PLAN_LENGTH) {
      throw new Error('계획 내용이 올바르지 않습니다.')
    }
    const key = planKey(date)
    const hadEntry = dailyPlanStore.has(key)
    // Keep the text as typed so autosave never rewrites what is on screen.
    if (payload.text.trim().length === 0) {
      dailyPlanStore.delete(key)
      if (hadEntry) options.dailyPlanChanged(listDates())
      return null
    }
    // Spread the stored plan so autosave keeps the hamster's last comment.
    const plan: DailyPlan = {
      ...dailyPlanStore.get(key),
      date,
      text: payload.text,
      updatedAt: new Date().toISOString()
    }
    dailyPlanStore.set(key, plan)
    if (!hadEntry) options.dailyPlanChanged(listDates())
    return plan
  })
  ipcMain.handle(IPC_CHANNELS.openDailyPlan, (event, rawDate?: unknown) => {
    assertTrusted(event)
    options.openDailyPlan(rawDate === undefined ? undefined : parseDateKey(rawDate))
  })
  ipcMain.handle(IPC_CHANNELS.commentOnDailyPlan, (event, rawDate: unknown) => {
    assertTrusted(event)
    return options.commentOnDailyPlan(parseDateKey(rawDate))
  })

  return () => {
    for (const channel of [
      IPC_CHANNELS.getDailyPlan,
      IPC_CHANNELS.listDailyPlanDates,
      IPC_CHANNELS.saveDailyPlan,
      IPC_CHANNELS.openDailyPlan,
      IPC_CHANNELS.commentOnDailyPlan
    ]) ipcMain.removeHandler(channel)
  }
}
