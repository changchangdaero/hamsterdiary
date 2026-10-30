import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import type { DiaryEntry, SaveDiaryPayload } from '../../shared/types/diary'
import { diaryStore } from '../stores/diaryStore'
import { parseDateKey } from './parseDateKey'

interface Options {
  getTrustedWindows: () => Array<BrowserWindow | null>
  openDiary: (date?: string) => void
  diaryChanged: (dates: string[]) => void
}

const diaryKey = (date: string): string => `diary:${date}`
const listDates = (): string[] =>
  Object.keys(diaryStore.store)
    .filter((key) => key.startsWith('diary:'))
    .map((key) => key.slice('diary:'.length))
    .sort()

export const registerDiaryIpc = (options: Options): (() => void) => {
  const assertTrusted = (event: IpcMainInvokeEvent): void => {
    const trusted = options.getTrustedWindows().some(
      (window) =>
        window !== null && !window.isDestroyed() && event.sender === window.webContents
    )
    if (!trusted) throw new Error('허용되지 않은 일기 요청입니다.')
  }

  ipcMain.handle(IPC_CHANNELS.getDiary, (event, rawDate: unknown) => {
    assertTrusted(event)
    const date = parseDateKey(rawDate)
    return diaryStore.get(diaryKey(date)) ?? null
  })
  ipcMain.handle(IPC_CHANNELS.listDiaryDates, (event) => {
    assertTrusted(event)
    return listDates()
  })
  ipcMain.handle(IPC_CHANNELS.saveDiary, (event, rawPayload: unknown) => {
    assertTrusted(event)
    if (typeof rawPayload !== 'object' || rawPayload === null) {
      throw new Error('저장할 일기를 확인해 주세요.')
    }
    const payload = rawPayload as Partial<SaveDiaryPayload>
    const date = parseDateKey(payload.date)
    if (typeof payload.text !== 'string') {
      throw new Error('일기 내용이 올바르지 않습니다.')
    }
    const key = diaryKey(date)
    const hadEntry = diaryStore.has(key)
    // Keep the text as typed so autosave never rewrites what is on screen.
    if (payload.text.trim().length === 0) {
      diaryStore.delete(key)
      if (hadEntry) options.diaryChanged(listDates())
      return null
    }
    // Spread the stored entry so older hamster replies survive autosave.
    const entry: DiaryEntry = {
      ...diaryStore.get(key),
      date,
      text: payload.text,
      updatedAt: new Date().toISOString()
    }
    diaryStore.set(key, entry)
    if (!hadEntry) options.diaryChanged(listDates())
    return entry
  })
  ipcMain.handle(IPC_CHANNELS.openDiary, (event, rawDate?: unknown) => {
    assertTrusted(event)
    options.openDiary(rawDate === undefined ? undefined : parseDateKey(rawDate))
  })

  return () => {
    for (const channel of [
      IPC_CHANNELS.getDiary,
      IPC_CHANNELS.listDiaryDates,
      IPC_CHANNELS.saveDiary,
      IPC_CHANNELS.openDiary
    ]) ipcMain.removeHandler(channel)
  }
}
