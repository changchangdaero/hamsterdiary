// 앱 수명 주기, 단일 인스턴스, 펫 창, 트레이 초기화를 담당하는 main 진입 파일입니다.
import {
  app,
  BrowserWindow,
  Notification,
  powerMonitor,
  screen
} from 'electron'
import { registerFoundationIpc } from './ipc/registerFoundationIpc'
import {
  registerPetIpc,
  type PetIpcController
} from './ipc/registerPetIpc'
import { registerScheduleIpc } from './ipc/registerScheduleIpc'
import { registerScheduleConversationIpc } from './ipc/registerScheduleConversationIpc'
import { registerReminderIpc } from './ipc/registerReminderIpc'
import { runtimeStore, settingsStore } from './stores'
import {
  createAppTray,
  type AppTrayController
} from './tray/createAppTray'
import { createMainWindow } from './windows/createMainWindow'
import { createPetWindow } from './windows/createPetWindow'
import { createScheduleDiaryWindow } from './windows/createScheduleDiaryWindow'
import { createSettingsWindow } from './windows/createSettingsWindow'
import {
  isPetPositionVisible,
  migratePetPosition,
  PET_WINDOW_LAYOUT_VERSION,
  PET_WINDOW_SIZE,
  resolvePetPosition
} from './windows/petPosition'
import { IPC_CHANNELS } from '../shared/ipcChannels'
import type { PetScheduleInputPlacement } from '../shared/types/pet'
import {
  NotificationScheduler,
  type PetNotificationRequest
} from './notifications/notificationScheduler'

let mainWindow: BrowserWindow | null = null
let petWindow: BrowserWindow | null = null
let scheduleDiaryWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let appTray: AppTrayController | null = null
let petIpcController: PetIpcController | null = null
let notificationScheduler: NotificationScheduler | null = null
let isQuitting = false
let isScheduleDiaryReady = false
let pendingNewSchedule = false
let pendingNewScheduleDate: string | undefined
let petScheduleInputPlacement: PetScheduleInputPlacement | null = null
const hasSingleInstanceLock = app.requestSingleInstanceLock()

const PET_SCHEDULE_INPUT_EXTRA_WIDTH = 400
const PET_SCHEDULE_INPUT_WINDOW_WIDTH =
  PET_WINDOW_SIZE.width + PET_SCHEDULE_INPUT_EXTRA_WIDTH

const isWindowAlive = (
  window: BrowserWindow | null
): window is BrowserWindow => window !== null && !window.isDestroyed()

const refreshTrayMenu = (): void => {
  appTray?.refreshMenu()
}

const broadcastSchedulesChanged = (
  schedules: import('../shared/types/schedule').Schedule[]
): void => {
  console.log('[schedule:ipc] broadcasting changed schedules', {
    count: schedules.length
  })
  for (const window of [
    mainWindow,
    petWindow,
    scheduleDiaryWindow,
    settingsWindow
  ]) {
    if (isWindowAlive(window)) {
      window.webContents.send(IPC_CHANNELS.schedulesChanged, schedules)
    }
  }
}

const closePetScheduleInput = (): void => {
  if (!petScheduleInputPlacement || !isWindowAlive(petWindow)) {
    petScheduleInputPlacement = null
    return
  }

  const expandedBounds = petWindow.getBounds()
  const compactX = Math.round(
    expandedBounds.x +
      petScheduleInputPlacement.petCenterX -
      PET_WINDOW_SIZE.width / 2
  )
  const compactY = Math.round(expandedBounds.y)
  petScheduleInputPlacement = null
  petWindow.setBounds(
    {
      x: compactX,
      y: compactY,
      ...PET_WINDOW_SIZE
    },
    false
  )
  runtimeStore.set('petPosition', { x: compactX, y: compactY })
  petWindow.webContents.send(IPC_CHANNELS.petScheduleInputClosed)
}

const ensurePetWindow = (): BrowserWindow => {
  if (isWindowAlive(petWindow)) {
    return petWindow
  }

  const savedPosition = runtimeStore.get('petPosition')
  const storedLayoutVersion = runtimeStore.get('petWindowLayoutVersion')
  const layoutVersion =
    Number.isSafeInteger(storedLayoutVersion) && storedLayoutVersion >= 1
      ? storedLayoutVersion
      : 1
  const position = migratePetPosition(savedPosition, layoutVersion)
  if (layoutVersion < PET_WINDOW_LAYOUT_VERSION) {
    runtimeStore.set({
      ...runtimeStore.store,
      petPosition: position,
      petWindowLayoutVersion: PET_WINDOW_LAYOUT_VERSION
    })
  } else if (
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
    closePetScheduleInput()
    petWindow = null
    refreshTrayMenu()
  })

  return petWindow
}

const showPet = (focus = false): BrowserWindow => {
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
  return window
}

const hidePet = (): void => {
  settingsStore.set('petEnabled', false)
  petIpcController?.cancelDrag()
  closePetScheduleInput()
  if (isWindowAlive(petWindow)) {
    petWindow.webContents.send(IPC_CHANNELS.petWindowHidden)
    petWindow.setIgnoreMouseEvents(true, { forward: true })
    petWindow.hide()
  }
  refreshTrayMenu()
}

const togglePetScheduleInput = (): void => {
  if (petScheduleInputPlacement) {
    closePetScheduleInput()
    return
  }

  const currentPetWindow = showPet()
  const compactBounds = currentPetWindow.getBounds()
  const { workArea } = screen.getDisplayMatching(compactBounds)
  const workAreaRight = workArea.x + workArea.width
  const rightFits =
    compactBounds.x + PET_SCHEDULE_INPUT_WINDOW_WIDTH <= workAreaRight
  const leftFits =
    compactBounds.x - PET_SCHEDULE_INPUT_EXTRA_WIDTH >= workArea.x
  const rightSpace = workAreaRight - (compactBounds.x + compactBounds.width)
  const leftSpace = compactBounds.x - workArea.x
  const side: PetScheduleInputPlacement['side'] =
    rightFits || (!leftFits && rightSpace >= leftSpace) ? 'right' : 'left'
  const desiredX =
    side === 'right'
      ? compactBounds.x
      : compactBounds.x - PET_SCHEDULE_INPUT_EXTRA_WIDTH
  const maximumX = workAreaRight - PET_SCHEDULE_INPUT_WINDOW_WIDTH
  const expandedX = Math.round(
    Math.min(Math.max(desiredX, workArea.x), maximumX)
  )
  const placement: PetScheduleInputPlacement = {
    side,
    petCenterX:
      compactBounds.x + PET_WINDOW_SIZE.width / 2 - expandedX
  }

  petScheduleInputPlacement = placement
  currentPetWindow.setBounds(
    {
      x: expandedX,
      y: compactBounds.y,
      width: PET_SCHEDULE_INPUT_WINDOW_WIDTH,
      height: PET_WINDOW_SIZE.height
    },
    false
  )
  currentPetWindow.setIgnoreMouseEvents(false)
  currentPetWindow.webContents.send(
    IPC_CHANNELS.petScheduleInputOpened,
    placement
  )
  currentPetWindow.focus()
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

const openSettingsWindow = (): void => {
  if (!isWindowAlive(settingsWindow)) {
    settingsWindow = createSettingsWindow()
    settingsWindow.once('closed', () => {
      settingsWindow = null
    })
    return
  }
  if (settingsWindow.isMinimized()) {
    settingsWindow.restore()
  }
  settingsWindow.show()
  settingsWindow.focus()
}

const showPetNotification = (request: PetNotificationRequest): void => {
  const window = showPet(true)
  const deliver = (): void => {
    if (window.isDestroyed()) {
      return
    }
    window.webContents.send(IPC_CHANNELS.petEmotionChanged, 'happy')
    const messageTimer = setTimeout(() => {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.petMessageShown, {
          text: request.message,
          finalEmotion: 'happy',
          typingSpeed: 28,
          visibleDuration: 6_000
        })
      }
    }, 450)
    messageTimer.unref()
  }
  if (window.webContents.isLoadingMainFrame()) {
    window.webContents.once('did-finish-load', deliver)
  } else {
    deliver()
  }

  if (request.showOsNotification && Notification.isSupported()) {
    new Notification({
      title: request.title,
      body: request.message
    }).show()
  }
}

const openScheduleDiary = (openNew = false, date?: string): void => {
  if (openNew) {
    pendingNewSchedule = true
    pendingNewScheduleDate = date
  }

  if (!isWindowAlive(scheduleDiaryWindow)) {
    isScheduleDiaryReady = false
    scheduleDiaryWindow = createScheduleDiaryWindow()
    scheduleDiaryWindow.once('closed', () => {
      scheduleDiaryWindow = null
      isScheduleDiaryReady = false
      pendingNewSchedule = false
      pendingNewScheduleDate = undefined
    })
  } else {
    if (scheduleDiaryWindow.isMinimized()) {
      scheduleDiaryWindow.restore()
    }
    scheduleDiaryWindow.show()
    scheduleDiaryWindow.focus()
  }

  if (pendingNewSchedule && isScheduleDiaryReady) {
    scheduleDiaryWindow.webContents.send(
      IPC_CHANNELS.scheduleOpenNewRequested,
      pendingNewScheduleDate
    )
    pendingNewSchedule = false
    pendingNewScheduleDate = undefined
  }
}

const markScheduleDiaryReady = (): void => {
  isScheduleDiaryReady = true
  if (
    pendingNewSchedule &&
    isWindowAlive(scheduleDiaryWindow)
  ) {
    scheduleDiaryWindow.webContents.send(
      IPC_CHANNELS.scheduleOpenNewRequested,
      pendingNewScheduleDate
    )
    pendingNewSchedule = false
    pendingNewScheduleDate = undefined
  }
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
    app.setAppUserModelId('com.example.desktoppetscheduler')
    registerFoundationIpc()
    notificationScheduler = new NotificationScheduler({
      notify: showPetNotification
    })
    notificationScheduler.start()
    petIpcController = registerPetIpc({
      getPetWindow: () => petWindow,
      getFoundationWindow: () => mainWindow,
      showPet: () => showPet(),
      hidePet,
      openScheduleDiary: () => openScheduleDiary(false),
      openNewSchedule: () => openScheduleDiary(true),
      togglePetScheduleInput,
      closePetScheduleInput,
      openSettings: openSettingsWindow,
      quitApp
    })
    registerScheduleIpc({
      getTrustedWindows: () => [
        mainWindow,
        petWindow,
        scheduleDiaryWindow,
        settingsWindow
      ],
      getScheduleDiaryWindow: () => scheduleDiaryWindow,
      openScheduleDiary,
      scheduleDiaryReady: markScheduleDiaryReady,
      schedulesChanged: broadcastSchedulesChanged
    })
    registerScheduleConversationIpc({
      getPetWindow: () => petWindow,
      schedulesChanged: broadcastSchedulesChanged
    })
    registerReminderIpc({
      getTrustedWindows: () => [
        mainWindow,
        petWindow,
        scheduleDiaryWindow,
        settingsWindow
      ],
      scheduler: notificationScheduler
    })

    ensurePetWindow()
    appTray = createAppTray({
      isPetVisible: () => isWindowAlive(petWindow) && petWindow.isVisible(),
      showPet: () => showPet(),
      hidePet,
      openScheduleDiary: () => openScheduleDiary(false),
      openNewSchedule: () => openScheduleDiary(true),
      showFoundation: showFoundationWindow,
      openSettings: openSettingsWindow,
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
        petWindow.setPosition(
          Math.round(position.x),
          Math.round(position.y),
          false
        )
        runtimeStore.set('petPosition', position)
      }
    }
    screen.on('display-metrics-changed', validateCurrentPetPosition)
    screen.on('display-added', validateCurrentPetPosition)
    screen.on('display-removed', validateCurrentPetPosition)
    powerMonitor.on('resume', () => {
      notificationScheduler?.rescheduleSchedules()
      notificationScheduler?.rescheduleRepeating()
    })

    if (settingsStore.get('petEnabled')) {
      showPet()
    }

    app.on('activate', () => showPet())
  })

  app.on('before-quit', () => {
    isQuitting = true
    notificationScheduler?.dispose()
  })

  app.on('window-all-closed', () => {
    if (isQuitting) {
      app.quit()
    }
  })
}
