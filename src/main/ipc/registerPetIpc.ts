// 펫 클릭 통과와 수동 드래그 요청을 검증해 BrowserWindow에 적용하는 파일입니다.
import { BrowserWindow, ipcMain, type IpcMainEvent } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import { runtimeStore } from '../stores'

interface DragState {
  pointerStartX: number
  pointerStartY: number
  windowStartX: number
  windowStartY: number
  moved: boolean
}

const MAXIMUM_SCREEN_COORDINATE = 1_000_000

const isValidCoordinate = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  Math.abs(value) <= MAXIMUM_SCREEN_COORDINATE

const isPetSender = (
  event: IpcMainEvent,
  petWindow: BrowserWindow | null
): petWindow is BrowserWindow =>
  petWindow !== null &&
  !petWindow.isDestroyed() &&
  event.sender === petWindow.webContents

export const registerPetIpc = (
  getPetWindow: () => BrowserWindow | null
): (() => void) => {
  let dragState: DragState | null = null

  const setMouseInteractive = (
    event: IpcMainEvent,
    interactive: unknown
  ): void => {
    const petWindow = getPetWindow()
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
    screenX: unknown,
    screenY: unknown
  ): void => {
    const petWindow = getPetWindow()
    if (
      !isPetSender(event, petWindow) ||
      !isValidCoordinate(screenX) ||
      !isValidCoordinate(screenY)
    ) {
      return
    }

    const [windowStartX, windowStartY] = petWindow.getPosition()
    dragState = {
      pointerStartX: screenX,
      pointerStartY: screenY,
      windowStartX,
      windowStartY,
      moved: false
    }
    petWindow.setIgnoreMouseEvents(false)
  }

  const moveDrag = (
    event: IpcMainEvent,
    screenX: unknown,
    screenY: unknown
  ): void => {
    const petWindow = getPetWindow()
    if (
      !dragState ||
      !isPetSender(event, petWindow) ||
      !isValidCoordinate(screenX) ||
      !isValidCoordinate(screenY)
    ) {
      return
    }

    const nextX = Math.round(
      dragState.windowStartX + screenX - dragState.pointerStartX
    )
    const nextY = Math.round(
      dragState.windowStartY + screenY - dragState.pointerStartY
    )
    if (!isValidCoordinate(nextX) || !isValidCoordinate(nextY)) {
      return
    }

    petWindow.setPosition(nextX, nextY)
    dragState.moved = true
  }

  const endDrag = (event: IpcMainEvent): void => {
    const petWindow = getPetWindow()
    if (!isPetSender(event, petWindow)) {
      dragState = null
      return
    }

    if (dragState?.moved) {
      const [x, y] = petWindow.getPosition()
      runtimeStore.set('petPosition', { x, y })
    }
    dragState = null
  }

  ipcMain.on(IPC_CHANNELS.setPetMouseInteractive, setMouseInteractive)
  ipcMain.on(IPC_CHANNELS.beginPetDrag, beginDrag)
  ipcMain.on(IPC_CHANNELS.movePetDrag, moveDrag)
  ipcMain.on(IPC_CHANNELS.endPetDrag, endDrag)

  return () => {
    ipcMain.removeListener(
      IPC_CHANNELS.setPetMouseInteractive,
      setMouseInteractive
    )
    ipcMain.removeListener(IPC_CHANNELS.beginPetDrag, beginDrag)
    ipcMain.removeListener(IPC_CHANNELS.movePetDrag, moveDrag)
    ipcMain.removeListener(IPC_CHANNELS.endPetDrag, endDrag)
  }
}
