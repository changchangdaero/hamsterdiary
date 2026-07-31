// 펫 옆 자연어 일정 입력 창을 생성하고 화면 작업 영역 안에 배치하는 파일입니다.
import { join } from 'node:path'
import { BrowserWindow, screen, type Rectangle } from 'electron'

const INPUT_WINDOW_SIZE = { width: 420, height: 320 } as const
const INPUT_WINDOW_GAP = 12

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum)

export const resolvePetScheduleInputPosition = (
  petBounds: Rectangle,
  workArea: Rectangle
): { x: number; y: number } => {
  const rightX = petBounds.x + petBounds.width + INPUT_WINDOW_GAP
  const leftX = petBounds.x - INPUT_WINDOW_SIZE.width - INPUT_WINDOW_GAP
  const workAreaRight = workArea.x + workArea.width
  const workAreaBottom = workArea.y + workArea.height

  return {
    x:
      rightX + INPUT_WINDOW_SIZE.width <= workAreaRight
        ? rightX
        : leftX >= workArea.x
          ? leftX
          : clamp(
              rightX,
              workArea.x,
              workAreaRight - INPUT_WINDOW_SIZE.width
            ),
    y: clamp(
      petBounds.y + petBounds.height - INPUT_WINDOW_SIZE.height,
      workArea.y,
      workAreaBottom - INPUT_WINDOW_SIZE.height
    )
  }
}

export const positionPetScheduleInputWindow = (
  petWindow: BrowserWindow,
  inputWindow: BrowserWindow
): void => {
  if (petWindow.isDestroyed() || inputWindow.isDestroyed()) {
    return
  }

  const petBounds = petWindow.getBounds()
  const { workArea } = screen.getDisplayMatching(petBounds)
  const { x, y } = resolvePetScheduleInputPosition(petBounds, workArea)

  inputWindow.setPosition(Math.round(x), Math.round(y), false)
}

export const createPetScheduleInputWindow = (
  petWindow: BrowserWindow
): BrowserWindow => {
  const inputWindow = new BrowserWindow({
    ...INPUT_WINDOW_SIZE,
    parent: petWindow,
    transparent: true,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  positionPetScheduleInputWindow(petWindow, inputWindow)
  inputWindow.once('ready-to-show', () => {
    if (!inputWindow.isDestroyed()) {
      positionPetScheduleInputWindow(petWindow, inputWindow)
      inputWindow.show()
      inputWindow.focus()
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    url.searchParams.set('window', 'pet-schedule-input')
    void inputWindow.loadURL(url.toString())
  } else {
    void inputWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { window: 'pet-schedule-input' }
    })
  }

  return inputWindow
}
