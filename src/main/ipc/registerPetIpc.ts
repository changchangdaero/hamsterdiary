// 펫 상호작용, 메시지 전달, 네이티브 메뉴 IPC를 검증해 처리하는 파일입니다.
import {
  BrowserWindow,
  Menu,
  ipcMain,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import {
  PET_EMOTIONS,
  type PetDragMovePayload,
  type PetEmotion,
  type ResolvedPetMessage
} from '../../shared/types/pet'
import { runtimeStore } from '../stores'

interface DragState {
  pointerStartX: number
  pointerStartY: number
  windowStartX: number
  windowStartY: number
  moved: boolean
}

interface RegisterPetIpcOptions {
  getPetWindow: () => BrowserWindow | null
  getFoundationWindow: () => BrowserWindow | null
  showPet: () => BrowserWindow
  hidePet: () => void
  openScheduleDiary: () => void
  openNewSchedule: () => void
  togglePetScheduleInput: () => void
  closePetScheduleInput: () => void
  openSettings: () => void
  openHelp: () => void
  quitApp: () => void
}

export interface PetIpcController {
  cancelDrag: () => void
  dispose: () => void
}

const MAXIMUM_SCREEN_COORDINATE = 1_000_000
const DEFAULT_TYPING_SPEED = 28
const DEFAULT_VISIBLE_DURATION = 4_000
const MINIMUM_TYPING_SPEED = 10
const MAXIMUM_TYPING_SPEED = 120
const MINIMUM_VISIBLE_DURATION = 1_000
const MAXIMUM_VISIBLE_DURATION = 15_000
const MAXIMUM_MESSAGE_LENGTH = 200

const segmentGraphemes = (text: string): string[] => {
  if ('Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), ({ segment }) => segment)
  }

  return Array.from(text)
}

export const toFiniteInteger = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return Math.round(value)
}

const isAllowedCoordinate = (value: number): boolean =>
  Number.isInteger(value) && Math.abs(value) <= MAXIMUM_SCREEN_COORDINATE

export const parsePetDragMovePayload = (
  value: unknown
): PetDragMovePayload | null => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !Object.hasOwn(value, 'screenX') ||
    !Object.hasOwn(value, 'screenY') ||
    Object.keys(value).length !== 2
  ) {
    return null
  }

  const payload = value as Record<string, unknown>
  const screenX = toFiniteInteger(payload.screenX)
  const screenY = toFiniteInteger(payload.screenY)
  if (
    screenX === null ||
    screenY === null ||
    !isAllowedCoordinate(screenX) ||
    !isAllowedCoordinate(screenY)
  ) {
    return null
  }

  return { screenX, screenY }
}

const logDragError = (channel: string, message: string): void => {
  console.error(`[${channel}] ${message}`)
}

const isPetEmotion = (value: unknown): value is PetEmotion =>
  typeof value === 'string' &&
  PET_EMOTIONS.some((emotion) => emotion === value)

const isWindowAlive = (
  window: BrowserWindow | null
): window is BrowserWindow => window !== null && !window.isDestroyed()

const isPetSender = (
  event: IpcMainEvent | IpcMainInvokeEvent,
  petWindow: BrowserWindow | null
): petWindow is BrowserWindow =>
  isWindowAlive(petWindow) && event.sender === petWindow.webContents

const isTrustedCommandSender = (
  event: IpcMainInvokeEvent,
  options: RegisterPetIpcOptions
): boolean => {
  const petWindow = options.getPetWindow()
  const foundationWindow = options.getFoundationWindow()

  return (
    (isWindowAlive(petWindow) && event.sender === petWindow.webContents) ||
    (isWindowAlive(foundationWindow) &&
      event.sender === foundationWindow.webContents)
  )
}

const toBoundedNumber = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= minimum &&
  value <= maximum
    ? value
    : fallback

const resolveMessage = (value: unknown): ResolvedPetMessage => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('올바른 메시지가 필요합니다.')
  }

  const payload = value as Record<string, unknown>
  if (typeof payload.text !== 'string') {
    throw new Error('메시지 본문은 문자열이어야 합니다.')
  }

  const text = payload.text.trim()
  if (text.length === 0) {
    throw new Error('빈 메시지는 표시할 수 없습니다.')
  }

  return {
    text: segmentGraphemes(text).slice(0, MAXIMUM_MESSAGE_LENGTH).join(''),
    finalEmotion: isPetEmotion(payload.finalEmotion)
      ? payload.finalEmotion
      : 'idle',
    typingSpeed: toBoundedNumber(
      payload.typingSpeed,
      DEFAULT_TYPING_SPEED,
      MINIMUM_TYPING_SPEED,
      MAXIMUM_TYPING_SPEED
    ),
    visibleDuration: toBoundedNumber(
      payload.visibleDuration,
      DEFAULT_VISIBLE_DURATION,
      MINIMUM_VISIBLE_DURATION,
      MAXIMUM_VISIBLE_DURATION
    )
  }
}

const sendWhenReady = (
  petWindow: BrowserWindow,
  channel: string,
  payload?: PetEmotion | ResolvedPetMessage
): void => {
  const send = (): void => {
    if (!petWindow.isDestroyed()) {
      petWindow.webContents.send(channel, payload)
    }
  }

  if (petWindow.webContents.isLoadingMainFrame()) {
    petWindow.webContents.once('did-finish-load', send)
  } else {
    send()
  }
}

export const registerPetIpc = (
  options: RegisterPetIpcOptions
): PetIpcController => {
  let dragState: DragState | null = null

  const cancelDrag = (): void => {
    dragState = null
  }

  const setMouseInteractive = (
    event: IpcMainEvent,
    interactive: unknown
  ): void => {
    const petWindow = options.getPetWindow()
    if (
      !isPetSender(event, petWindow) ||
      typeof interactive !== 'boolean' ||
      (dragState !== null && !interactive)
    ) {
      return
    }

    petWindow.setIgnoreMouseEvents(
      !interactive,
      interactive ? undefined : { forward: true }
    )
  }

  const beginDrag = (
    event: IpcMainEvent,
    value: unknown,
    ...args: unknown[]
  ): void => {
    const petWindow = options.getPetWindow()
    const payload = parsePetDragMovePayload(value)
    if (
      !isPetSender(event, petWindow) ||
      payload === null ||
      args.length !== 0 ||
      !petWindow.isVisible()
    ) {
      return
    }

    try {
      const [rawWindowStartX, rawWindowStartY] = petWindow.getPosition()
      const windowStartX = toFiniteInteger(rawWindowStartX)
      const windowStartY = toFiniteInteger(rawWindowStartY)
      if (
        windowStartX === null ||
        windowStartY === null ||
        !isAllowedCoordinate(windowStartX) ||
        !isAllowedCoordinate(windowStartY)
      ) {
        cancelDrag()
        return
      }

      dragState = {
        pointerStartX: payload.screenX,
        pointerStartY: payload.screenY,
        windowStartX,
        windowStartY,
        moved: false
      }
      petWindow.setIgnoreMouseEvents(false)
    } catch {
      cancelDrag()
      logDragError(
        IPC_CHANNELS.beginPetDrag,
        '펫 드래그를 시작하지 못했습니다.'
      )
    }
  }

  const moveDrag = (
    event: IpcMainEvent,
    value: unknown,
    ...args: unknown[]
  ): void => {
    const petWindow = options.getPetWindow()
    const payload = parsePetDragMovePayload(value)
    if (
      !dragState ||
      !isPetSender(event, petWindow) ||
      payload === null ||
      args.length !== 0 ||
      !petWindow.isVisible()
    ) {
      return
    }

    const pointerStartX = toFiniteInteger(dragState.pointerStartX)
    const pointerStartY = toFiniteInteger(dragState.pointerStartY)
    const windowStartX = toFiniteInteger(dragState.windowStartX)
    const windowStartY = toFiniteInteger(dragState.windowStartY)
    if (
      pointerStartX === null ||
      pointerStartY === null ||
      windowStartX === null ||
      windowStartY === null
    ) {
      cancelDrag()
      return
    }

    const nextX = toFiniteInteger(
      windowStartX + payload.screenX - pointerStartX
    )
    const nextY = toFiniteInteger(
      windowStartY + payload.screenY - pointerStartY
    )
    if (
      nextX === null ||
      nextY === null ||
      !isAllowedCoordinate(nextX) ||
      !isAllowedCoordinate(nextY)
    ) {
      return
    }

    try {
      petWindow.setPosition(Math.round(nextX), Math.round(nextY), false)
      dragState.moved = true
    } catch {
      cancelDrag()
      logDragError(
        IPC_CHANNELS.movePetDrag,
        '펫 창 위치를 변경하지 못했습니다.'
      )
    }
  }

  const endDrag = (event: IpcMainEvent, ...args: unknown[]): void => {
    const petWindow = options.getPetWindow()
    if (!isPetSender(event, petWindow) || args.length !== 0) {
      cancelDrag()
      return
    }

    try {
      if (dragState?.moved) {
        const [rawX, rawY] = petWindow.getPosition()
        const x = toFiniteInteger(rawX)
        const y = toFiniteInteger(rawY)
        if (x !== null && y !== null) {
          runtimeStore.set('petPosition', { x, y })
        }
      }
    } catch {
      logDragError(
        IPC_CHANNELS.endPetDrag,
        '펫 위치를 저장하지 못했습니다.'
      )
    } finally {
      cancelDrag()
    }
  }

  const setEmotion = (
    event: IpcMainInvokeEvent,
    emotion: unknown,
    ...args: unknown[]
  ): void => {
    if (
      !isTrustedCommandSender(event, options) ||
      !isPetEmotion(emotion) ||
      args.length !== 0
    ) {
      throw new Error('허용되지 않은 감정 상태입니다.')
    }

    const petWindow = options.showPet()
    sendWhenReady(petWindow, IPC_CHANNELS.petEmotionChanged, emotion)
  }

  const showMessage = (
    event: IpcMainInvokeEvent,
    payload: unknown,
    ...args: unknown[]
  ): void => {
    if (!isTrustedCommandSender(event, options) || args.length !== 0) {
      throw new Error('허용되지 않은 요청입니다.')
    }

    const message = resolveMessage(payload)
    const petWindow = options.showPet()
    sendWhenReady(petWindow, IPC_CHANNELS.petMessageShown, message)
  }

  const hideMessage = (event: IpcMainInvokeEvent, ...args: unknown[]): void => {
    if (!isTrustedCommandSender(event, options) || args.length !== 0) {
      throw new Error('허용되지 않은 요청입니다.')
    }

    const petWindow = options.getPetWindow()
    if (isWindowAlive(petWindow)) {
      sendWhenReady(petWindow, IPC_CHANNELS.petMessageHidden)
    }
  }

  const showContextMenu = (event: IpcMainEvent, ...args: unknown[]): void => {
    const petWindow = options.getPetWindow()
    if (!isPetSender(event, petWindow) || args.length !== 0 || dragState) {
      return
    }

    Menu.buildFromTemplate([
      { label: '일정 다이어리 열기', click: options.openScheduleDiary },
      { label: '새 일정 추가', click: options.openNewSchedule },
      { label: '말 걸기', click: options.togglePetScheduleInput },
      { type: 'separator' },
      {
        label: '펫 표시',
        type: 'checkbox',
        checked: true,
        enabled: false
      },
      { label: '펫 숨기기', click: options.hidePet },
      { type: 'separator' },
      { label: '설정', click: options.openSettings },
      { label: '도움말', click: options.openHelp },
      { label: '앱 종료', click: options.quitApp }
    ]).popup({ window: petWindow })
  }

  const closeScheduleInput = (
    event: IpcMainEvent,
    ...args: unknown[]
  ): void => {
    const petWindow = options.getPetWindow()
    if (!isPetSender(event, petWindow) || args.length !== 0) {
      return
    }
    options.closePetScheduleInput()
  }

  ipcMain.on(IPC_CHANNELS.setPetMouseInteractive, setMouseInteractive)
  ipcMain.on(IPC_CHANNELS.beginPetDrag, beginDrag)
  ipcMain.on(IPC_CHANNELS.movePetDrag, moveDrag)
  ipcMain.on(IPC_CHANNELS.endPetDrag, endDrag)
  ipcMain.on(IPC_CHANNELS.showPetContextMenu, showContextMenu)
  ipcMain.on(IPC_CHANNELS.closePetScheduleInput, closeScheduleInput)
  ipcMain.handle(IPC_CHANNELS.setPetEmotion, setEmotion)
  ipcMain.handle(IPC_CHANNELS.showPetMessage, showMessage)
  ipcMain.handle(IPC_CHANNELS.hidePetMessage, hideMessage)

  const dispose = (): void => {
    cancelDrag()
    ipcMain.removeListener(
      IPC_CHANNELS.setPetMouseInteractive,
      setMouseInteractive
    )
    ipcMain.removeListener(IPC_CHANNELS.beginPetDrag, beginDrag)
    ipcMain.removeListener(IPC_CHANNELS.movePetDrag, moveDrag)
    ipcMain.removeListener(IPC_CHANNELS.endPetDrag, endDrag)
    ipcMain.removeListener(IPC_CHANNELS.showPetContextMenu, showContextMenu)
    ipcMain.removeListener(
      IPC_CHANNELS.closePetScheduleInput,
      closeScheduleInput
    )
    ipcMain.removeHandler(IPC_CHANNELS.setPetEmotion)
    ipcMain.removeHandler(IPC_CHANNELS.showPetMessage)
    ipcMain.removeHandler(IPC_CHANNELS.hidePetMessage)
  }

  return { cancelDrag, dispose }
}
