// 앱 수명 주기, 단일 인스턴스, 펫 창, 트레이 초기화를 담당하는 main 진입 파일입니다.
import { app, BrowserWindow, screen } from 'electron'
import { registerFoundationIpc } from './ipc/registerFoundationIpc'
import { registerPetIpc } from './ipc/registerPetIpc'
import { runtimeStore, settingsStore } from './stores'
import {
  createAppTray,
  type AppTrayController
} from './tray/createAppTray'
import { createMainWindow } from './windows/createMainWindow'
import { createPetWindow } from './windows/createPetWindow'
import {
  isPetPositionVisible,
  resolvePetPosition
} from './windows/petPosition'

let mainWindow: BrowserWindow | null = null
let petWindow: BrowserWindow | null = null
let appTray: AppTrayController | null = null
let isQuitting = false
const hasSingleInstanceLock = app.requestSingleInstanceLock()

const isWindowAlive = (
  window: BrowserWindow | null
): window is BrowserWindow => window !== null && !window.isDestroyed()

const refreshTrayMenu = (): void => {
  appTray?.refreshMenu()
}

const ensurePetWindow = (): BrowserWindow => {
  if (isWindowAlive(petWindow)) {
    return petWindow
  }

  const savedPosition = runtimeStore.get('petPosition')
  const position = resolvePetPosition(savedPosition)
  if (
    !savedPosition ||
    savedPosition.x !== position.x ||
    savedPosition.y !== position.y
  ) {
    runtimeStore.set('petPosition', position)
  }

  petWindow = createPetWindow({
    position,
    shouldShow: () => settingsStore.get('petEnabled')
  })
  petWindow.once('closed', () => {
    petWindow = null
    refreshTrayMenu()
  })

  return petWindow
}

const showPet = (focus = false): void => {
  settingsStore.set('petEnabled', true)
  const window = ensurePetWindow()
  window.setIgnoreMouseEvents(true, { forward: true })

  if (!window.webContents.isLoadingMainFrame()) {
    if (focus) {
      window.show()
      window.moveTop()
    } else {
      window.showInactive()
    }
  }
  refreshTrayMenu()
}

const hidePet = (): void => {
  settingsStore.set('petEnabled', false)
  if (isWindowAlive(petWindow)) {
    petWindow.setIgnoreMouseEvents(true, { forward: true })
    petWindow.hide()
  }
  refreshTrayMenu()
}

const showFoundationWindow = (): void => {
  if (!isWindowAlive(mainWindow)) {
    mainWindow = createMainWindow()
    mainWindow.once('closed', () => {
      mainWindow = null
    })
    return
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
}

const quitApp = (): void => {
  isQuitting = true
  app.quit()
}

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showPet(true)
  })

  void app.whenReady().then(() => {
    registerFoundationIpc()
    registerPetIpc(() => petWindow)

    ensurePetWindow()
    appTray = createAppTray({
      isPetVisible: () => isWindowAlive(petWindow) && petWindow.isVisible(),
      showPet: () => showPet(),
      hidePet,
      showFoundation: showFoundationWindow,
      quitApp
    })

    const validateCurrentPetPosition = (): void => {
      if (!isWindowAlive(petWindow)) {
        return
      }

      const [x, y] = petWindow.getPosition()
      const currentPosition = { x, y }
      if (!isPetPositionVisible(currentPosition)) {
        const position = resolvePetPosition(null)
        petWindow.setPosition(position.x, position.y)
        runtimeStore.set('petPosition', position)
      }
    }
    screen.on('display-metrics-changed', validateCurrentPetPosition)
    screen.on('display-added', validateCurrentPetPosition)
    screen.on('display-removed', validateCurrentPetPosition)

    if (settingsStore.get('petEnabled')) {
      showPet()
    }

    app.on('activate', () => showPet())
  })

  app.on('before-quit', () => {
    isQuitting = true
  })

  app.on('window-all-closed', () => {
    if (isQuitting) {
      app.quit()
    }
  })
}
