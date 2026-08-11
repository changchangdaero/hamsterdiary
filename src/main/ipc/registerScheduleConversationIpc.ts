import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import type {
  ScheduleConversationRequest,
  ScheduleConversationTurn
} from '../../shared/types/scheduleConversation'
import { converseAboutSchedule } from '../services/geminiScheduleConversation'
import {
  createStoredScheduleFromConversation,
  createStoredSchedulesFromConversation,
  deleteStoredSchedulesByIds,
  deleteStoredSchedulesByRange,
  deleteStoredScheduleById,
  listStoredSchedulesFiltered,
  moveStoredScheduleById
} from './registerScheduleIpc'
import type { Schedule } from '../../shared/types/schedule'

interface Options {
  getPetWindow: () => BrowserWindow | null
  schedulesChanged: (schedules: Schedule[]) => void
}

const validateTurn = (value: unknown): value is ScheduleConversationTurn => {
  if (typeof value !== 'object' || value === null) return false
  const turn = value as Record<string, unknown>
  return (
    (turn.role === 'user' || turn.role === 'assistant') &&
    typeof turn.text === 'string' &&
    turn.text.length > 0 &&
    turn.text.length <= (turn.role === 'user' ? 500 : 4_000)
  )
}

const validateRequest = (value: unknown): ScheduleConversationRequest => {
  if (typeof value !== 'object' || value === null) throw new Error('대화 요청이 올바르지 않습니다.')
  const request = value as Record<string, unknown>
  if (
    typeof request.message !== 'string' ||
    request.message.trim().length === 0 ||
    request.message.length > 500 ||
    !Array.isArray(request.history) ||
    request.history.length > 30 ||
    !request.history.every(validateTurn)
  ) {
    throw new Error('대화 요청이 올바르지 않습니다.')
  }
  return { message: request.message.trim(), history: request.history }
}

export const registerScheduleConversationIpc = (options: Options): (() => void) => {
  ipcMain.handle(
    IPC_CHANNELS.converseAboutSchedule,
    async (event: IpcMainInvokeEvent, value: unknown) => {
      const petWindow = options.getPetWindow()
      if (!petWindow || petWindow.isDestroyed() || event.sender !== petWindow.webContents) {
        throw new Error('허용되지 않은 대화 요청입니다.')
      }
      const request = validateRequest(value)
      console.log('[schedule:conversation] request received', {
        message: request.message,
        historyTurns: request.history.length
      })
      return converseAboutSchedule(request, {
        listSchedules: listStoredSchedulesFiltered,
        createSchedule: createStoredScheduleFromConversation,
        createSchedules: createStoredSchedulesFromConversation,
        deleteSchedule: deleteStoredScheduleById,
        deleteSchedules: deleteStoredSchedulesByIds,
        deleteSchedulesByRange: deleteStoredSchedulesByRange,
        moveSchedule: moveStoredScheduleById,
        schedulesChanged: options.schedulesChanged
      })
    }
  )
  return () => ipcMain.removeHandler(IPC_CHANNELS.converseAboutSchedule)
}
