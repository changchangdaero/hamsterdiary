// 햄이 동작 설정(빈도·잠드는 시간·꺼둔 동작)과 "햄이에게 시키기" 요청을 처리하는 IPC입니다.
import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import {
  DEFAULT_PET_BEHAVIOR_SETTINGS,
  PET_ACTIVITY_LEVELS,
  PET_IDLE_ACTION_IDS,
  PET_SLEEP_AFTER_MINUTES,
  type PetActionPlayStatus,
  type PetActionResult,
  type PetBehaviorSettings,
  type PetIdleActionId
} from '../../shared/types/pet'
import { settingsStore } from '../stores'

interface Options {
  getTrustedWindows: () => Array<BrowserWindow | null>
  getPetWindow: () => BrowserWindow | null
  showPet: () => BrowserWindow
  behaviorChanged: (settings: PetBehaviorSettings) => void
}

// How long to wait for the pet window to say whether it played the action.
const ACTION_RESULT_TIMEOUT_MS = 1_500

const isActionId = (value: unknown): value is PetIdleActionId =>
  PET_IDLE_ACTION_IDS.includes(value as PetIdleActionId)

const sanitize = (value: unknown): PetBehaviorSettings => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('햄이 동작 설정을 확인해 주세요.')
  }
  const raw = value as Partial<PetBehaviorSettings>
  if (
    !Array.isArray(raw.disabledActions) ||
    !PET_ACTIVITY_LEVELS.includes(raw.activityLevel as never) ||
    !PET_SLEEP_AFTER_MINUTES.includes(raw.sleepAfterMinutes as never)
  ) {
    throw new Error('햄이 동작 설정이 올바르지 않습니다.')
  }
  return {
    disabledActions: [...new Set(raw.disabledActions.filter(isActionId))],
    activityLevel: raw.activityLevel as PetBehaviorSettings['activityLevel'],
    sleepAfterMinutes: raw.sleepAfterMinutes as PetBehaviorSettings['sleepAfterMinutes']
  }
}

export const readPetBehaviorSettings = (): PetBehaviorSettings => {
  try {
    return sanitize(settingsStore.get('petBehavior'))
  } catch {
    return DEFAULT_PET_BEHAVIOR_SETTINGS
  }
}

export const registerPetBehaviorIpc = (options: Options): (() => void) => {
  const assertTrusted = (event: IpcMainInvokeEvent): void => {
    const trusted = options.getTrustedWindows().some(
      (window) =>
        window !== null && !window.isDestroyed() && event.sender === window.webContents
    )
    if (!trusted) throw new Error('허용되지 않은 햄이 동작 요청입니다.')
  }

  let nextRequestId = 1
  const pending = new Map<number, (played: boolean) => void>()
  const onResult = (event: Electron.IpcMainEvent, rawResult: unknown): void => {
    const petWindow = options.getPetWindow()
    if (!petWindow || petWindow.isDestroyed() || event.sender !== petWindow.webContents) {
      return
    }
    const result = rawResult as Partial<PetActionResult> | null
    if (typeof result?.requestId !== 'number' || typeof result.played !== 'boolean') return
    pending.get(result.requestId)?.(result.played)
  }
  ipcMain.on(IPC_CHANNELS.petActionResult, onResult)

  ipcMain.handle(IPC_CHANNELS.getPetBehaviorSettings, (event) => {
    assertTrusted(event)
    return readPetBehaviorSettings()
  })
  ipcMain.handle(IPC_CHANNELS.updatePetBehaviorSettings, (event, value: unknown) => {
    assertTrusted(event)
    const settings = sanitize(value)
    settingsStore.set('petBehavior', settings)
    options.behaviorChanged(settings)
    return settings
  })
  ipcMain.handle(
    IPC_CHANNELS.playPetAction,
    async (event, actionId: unknown): Promise<PetActionPlayStatus> => {
      assertTrusted(event)
      if (!isActionId(actionId)) throw new Error('알 수 없는 햄이 동작입니다.')
      const petWindow = options.showPet()
      const requestId = nextRequestId++
      const played = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(requestId)
          resolve(false)
        }, ACTION_RESULT_TIMEOUT_MS)
        pending.set(requestId, (value) => {
          clearTimeout(timer)
          pending.delete(requestId)
          resolve(value)
        })
        const send = (): void => {
          if (!petWindow.isDestroyed()) {
            petWindow.webContents.send(IPC_CHANNELS.petActionRequested, { requestId, actionId })
          }
        }
        if (petWindow.webContents.isLoadingMainFrame()) {
          petWindow.webContents.once('did-finish-load', send)
        } else {
          send()
        }
      })
      return played ? 'played' : 'busy'
    }
  )

  return () => {
    ipcMain.removeListener(IPC_CHANNELS.petActionResult, onResult)
    for (const channel of [
      IPC_CHANNELS.getPetBehaviorSettings,
      IPC_CHANNELS.updatePetBehaviorSettings,
      IPC_CHANNELS.playPetAction
    ]) ipcMain.removeHandler(channel)
  }
}
