import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import { listHolidays } from '../services/holidayService'

interface RegisterHolidayIpcOptions {
  getTrustedWindows: () => Array<BrowserWindow | null>
}

export const registerHolidayIpc = (
  options: RegisterHolidayIpcOptions
): (() => void) => {
  ipcMain.handle(
    IPC_CHANNELS.listHolidays,
    async (event: IpcMainInvokeEvent, years: unknown) => {
      const trusted = options.getTrustedWindows().some(
        (window) =>
          window !== null &&
          !window.isDestroyed() &&
          event.sender === window.webContents
      )
      if (!trusted) throw new Error('허용되지 않은 공휴일 조회 요청입니다.')
      if (!Array.isArray(years)) throw new Error('공휴일 연도 목록이 필요합니다.')
      return listHolidays(years.map(Number))
    }
  )
  return () => ipcMain.removeHandler(IPC_CHANNELS.listHolidays)
}

