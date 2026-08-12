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
import { registerHolidayIpc } from './ipc/registerHolidayIpc'
import { registerGeminiKeyIpc } from './ipc/registerGeminiKeyIpc'
import { registerHelpIpc } from './ipc/registerHelpIpc'
import { registerPomodoroIpc } from './ipc/registerPomodoroIpc'
import { registerTodoIpc } from './ipc/registerTodoIpc'
import { registerTodoConversationIpc } from './ipc/registerTodoConversationIpc'
import { registerDiaryIpc } from './ipc/registerDiaryIpc'
import { runtimeStore, schedulesStore, settingsStore } from './stores'
import {
  createAppTray,
  type AppTrayController
} from './tray/createAppTray'
import { createMainWindow } from './windows/createMainWindow'
import { createPetWindow } from './windows/createPetWindow'
import { createScheduleDiaryWindow } from './windows/createScheduleDiaryWindow'
import { createSettingsWindow } from './windows/createSettingsWindow'
import { createOnboardingWindow } from './windows/createOnboardingWindow'
import { createHelpWindow } from './windows/createHelpWindow'
import { createPomodoroWindow } from './windows/createPomodoroWindow'
import { createTodoWindow } from './windows/createTodoWindow'
import { createDiaryWindow } from './windows/createDiaryWindow'
import { getGeminiKeyStatus } from './services/geminiKeyService'
import { PomodoroTimerService } from './services/pomodoroTimerService'
import type { PomodoroEvent, PomodoroState } from '../shared/types/pomodoro'
import type { Todo } from '../shared/types/todo'
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
let helpWindow: BrowserWindow | null = null
let pomodoroWindow: BrowserWindow | null = null
let todoWindow: BrowserWindow | null = null
let diaryWindow: BrowserWindow | null = null
let appTray: AppTrayController | null = null
let petIpcController: PetIpcController | null = null
let notificationScheduler: NotificationScheduler | null = null
let pomodoroTimer: PomodoroTimerService | null = null
let isQuitting = false
let isScheduleDiaryReady = false
let pendingNewSchedule = false
let pendingNewScheduleDate: string | undefined
let petScheduleInputPlacement: PetScheduleInputPlacement | null = null
const hasSingleInstanceLock = app.requestSingleInstanceLock()

const isFocusActive = (): boolean => {
  const state = pomodoroTimer?.getState() ?? runtimeStore.get('pomodoro')
  return state.mode === 'focus' && state.runState === 'running'
}

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

  const bounds = petWindow.getBounds()
  console.log('[pet:schedule-input] closing', { bounds })
  petScheduleInputPlacement = null
  petWindow.webContents.send(IPC_CHANNELS.petScheduleInputClosed)
  console.log('[pet:schedule-input] closed', {
    bounds: petWindow.getBounds()
  })
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
  const bounds = currentPetWindow.getBounds()
  const placement: PetScheduleInputPlacement = {
    side: 'right',
    petCenterX: PET_WINDOW_SIZE.width / 2
  }

  console.log('[pet:schedule-input] opening', { bounds })
  petScheduleInputPlacement = placement
  currentPetWindow.setIgnoreMouseEvents(false)
  currentPetWindow.webContents.send(
    IPC_CHANNELS.petScheduleInputOpened,
    placement
  )
  currentPetWindow.focus()
  console.log('[pet:schedule-input] opened', {
    bounds: currentPetWindow.getBounds()
  })
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

const showOnboardingWindow = (): void => {
  if (isWindowAlive(mainWindow)) {
    mainWindow.show()
    mainWindow.focus()
    return
  }
  mainWindow = createOnboardingWindow()
  mainWindow.once('closed', () => {
    mainWindow = null
  })
}

const showFirstWelcome = (): void => {
  if (
    settingsStore.get('onboardingWelcomeShown') ||
    !getGeminiKeyStatus().configured
  ) {
    return
  }

  const window = showPet(true)
  const deliver = (): void => {
    if (window.isDestroyed()) return
    window.webContents.send(IPC_CHANNELS.petMessageShown, {
      text: '안녕! 드디어 만났네. 나는 네 책상 위에서 일정이랑 할 일을 챙기고, 집중할 때는 조용히 옆을 지켜주는 햄스터야. 하루가 끝나면 네 일기도 읽고 같이 기뻐하거나 토닥여줄게. 앞으로 네 하루를 곁에서 잘 모아볼게!',
      finalEmotion: 'happy',
      typingSpeed: 25,
      visibleDuration: 12_000
    })
    settingsStore.set('onboardingWelcomeShown', true)
  }

  if (window.webContents.isLoadingMainFrame()) {
    window.webContents.once('did-finish-load', deliver)
  } else {
    deliver()
  }
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

const openHelpWindow = (): void => {
  if (!isWindowAlive(helpWindow)) {
    helpWindow = createHelpWindow()
    helpWindow.once('closed', () => {
      helpWindow = null
    })
    return
  }
  if (helpWindow.isMinimized()) helpWindow.restore()
  helpWindow.show()
  helpWindow.focus()
}

const closeHelpWindow = (): void => {
  if (isWindowAlive(helpWindow)) helpWindow.close()
}

const openPomodoroWindow = (): void => {
  if (!isWindowAlive(pomodoroWindow)) {
    pomodoroWindow = createPomodoroWindow()
    pomodoroWindow.once('closed', () => {
      pomodoroWindow = null
    })
    return
  }
  if (pomodoroWindow.isMinimized()) pomodoroWindow.restore()
  pomodoroWindow.show()
  pomodoroWindow.focus()
}

const closePomodoroWindow = (): void => {
  if (isWindowAlive(pomodoroWindow)) pomodoroWindow.close()
}

const openTodoWindow = (): void => {
  if (!isWindowAlive(todoWindow)) {
    todoWindow = createTodoWindow()
    todoWindow.once('closed', () => {
      todoWindow = null
    })
    return
  }
  if (todoWindow.isMinimized()) todoWindow.restore()
  todoWindow.show()
  todoWindow.focus()
}

const closeTodoWindow = (): void => {
  if (isWindowAlive(todoWindow)) todoWindow.close()
}

const openDiaryWindow = (date?: string): void => {
  if (!isWindowAlive(diaryWindow)) {
    diaryWindow = createDiaryWindow(date)
    diaryWindow.once('closed', () => {
      diaryWindow = null
    })
  } else if (date) {
    diaryWindow.webContents.send(IPC_CHANNELS.diaryOpenDateRequested, date)
  }
  if (diaryWindow.isMinimized()) diaryWindow.restore()
  diaryWindow.show()
  diaryWindow.focus()
}

const closeDiaryWindow = (): void => {
  if (isWindowAlive(diaryWindow)) diaryWindow.close()
}

const broadcastDiaryChanged = (dates: string[]): void => {
  for (const window of [scheduleDiaryWindow, diaryWindow]) {
    if (isWindowAlive(window)) {
      window.webContents.send(IPC_CHANNELS.diaryChanged, dates)
    }
  }
}

const broadcastTodosChanged = (todos: Todo[]): void => {
  console.log('[todo:ipc] broadcasting changed todos', { count: todos.length })
  for (const window of [
    mainWindow,
    petWindow,
    scheduleDiaryWindow,
    settingsWindow,
    helpWindow,
    pomodoroWindow,
    todoWindow
  ]) {
    if (isWindowAlive(window)) {
      window.webContents.send(IPC_CHANNELS.todosChanged, todos)
    }
  }
}

const showTodoCompletionReaction = (allDone: boolean): void => {
  const window = showPet(true)
  const deliver = (): void => {
    if (window.isDestroyed()) return
    window.webContents.send(IPC_CHANNELS.petMessageShown, {
      text: allDone ? '다 끝냈다! 정말 대단해~' : '잘했어! 하나씩 같이 해내고 있네.',
      finalEmotion: allDone ? 'happy' : 'thumbsUp',
      typingSpeed: 25,
      visibleDuration: 5_000
    })
  }
  if (window.webContents.isLoadingMainFrame()) {
    window.webContents.once('did-finish-load', deliver)
  } else {
    deliver()
  }
}

const broadcastPomodoroChanged = (state: PomodoroState): void => {
  for (const window of [
    mainWindow,
    petWindow,
    scheduleDiaryWindow,
    settingsWindow,
    helpWindow,
    pomodoroWindow
  ]) {
    if (isWindowAlive(window)) {
      window.webContents.send(IPC_CHANNELS.pomodoroChanged, state)
    }
  }
}

const showPomodoroReaction = (event: PomodoroEvent): void => {
  const reactions = {
    'focus-started': {
      text: '같이 집중해보자! 내가 옆에서 함께할게.',
      emotion: 'talking' as const
    },
    'focus-completed': {
      text: '수고했어! 잠깐 쉬자~',
      emotion: 'sleep' as const
    },
    'break-completed': {
      text: '잘 쉬었지? 다시 같이 가볼까?',
      emotion: 'talking' as const
    }
  } satisfies Record<PomodoroEvent, { text: string; emotion: import('../shared/types/pet').PetEmotion }>
  const reaction = reactions[event]
  const window = showPet(true)
  const deliver = (): void => {
    if (window.isDestroyed()) return
    window.webContents.send(IPC_CHANNELS.petMessageShown, {
      text: reaction.text,
      finalEmotion: reaction.emotion,
      typingSpeed: 26,
      visibleDuration: 5_500
    })
  }
  if (window.webContents.isLoadingMainFrame()) {
    window.webContents.once('did-finish-load', deliver)
  } else {
    deliver()
  }
}

const NOTIFICATION_MESSAGE_DELAY = 450
const NOTIFICATION_TYPING_SPEED = 28
const NOTIFICATION_VISIBLE_DURATION = 6_000
const NOTIFICATION_EXIT_BUFFER = 200

interface ActivePetNotification {
  request: PetNotificationRequest
  messageTimer: ReturnType<typeof setTimeout> | null
  completionTimer: ReturnType<typeof setTimeout> | null
}

const pendingPetNotifications: PetNotificationRequest[] = []
const shownOsNotifications = new WeakSet<PetNotificationRequest>()
let activePetNotification: ActivePetNotification | null = null

const estimateNotificationTypingDuration = (text: string): number =>
  Array.from(text).reduce((duration, character) => {
    if (/[.!?。！？]/u.test(character)) return duration + NOTIFICATION_TYPING_SPEED + 130
    if (/[,，]/u.test(character)) return duration + NOTIFICATION_TYPING_SPEED + 65
    if (character === '\n') return duration + NOTIFICATION_TYPING_SPEED + 80
    return duration + NOTIFICATION_TYPING_SPEED
  }, 0)

const clearActiveNotificationTimers = (): void => {
  if (activePetNotification?.messageTimer) {
    clearTimeout(activePetNotification.messageTimer)
  }
  if (activePetNotification?.completionTimer) {
    clearTimeout(activePetNotification.completionTimer)
  }
}

const disposePetNotificationQueue = (): void => {
  clearActiveNotificationTimers()
  activePetNotification = null
  pendingPetNotifications.length = 0
}

const discardRepeatingPetNotifications = (): void => {
  for (let index = pendingPetNotifications.length - 1; index >= 0; index -= 1) {
    if (pendingPetNotifications[index].kind !== 'schedule') {
      pendingPetNotifications.splice(index, 1)
    }
  }
  if (
    activePetNotification &&
    activePetNotification.request.kind !== 'schedule'
  ) {
    clearActiveNotificationTimers()
    activePetNotification = null
    if (isWindowAlive(petWindow)) {
      petWindow.webContents.send(IPC_CHANNELS.petMessageHidden)
    }
    deliverNextPetNotification()
  }
}

const deliverNextPetNotification = (): void => {
  if (activePetNotification || pendingPetNotifications.length === 0) return

  const request = pendingPetNotifications.shift()!
  const active: ActivePetNotification = {
    request,
    messageTimer: null,
    completionTimer: null
  }
  activePetNotification = active
  const window = showPet(true)
  const deliver = (): void => {
    if (window.isDestroyed() || activePetNotification !== active) return

    if (
      request.showOsNotification &&
      !shownOsNotifications.has(request) &&
      Notification.isSupported()
    ) {
      new Notification({ title: request.title, body: request.message }).show()
      shownOsNotifications.add(request)
    }
    window.webContents.send(IPC_CHANNELS.petEmotionChanged, 'happy')
    active.messageTimer = setTimeout(() => {
      if (!window.isDestroyed() && activePetNotification === active) {
        window.webContents.send(IPC_CHANNELS.petMessageShown, {
          text: request.message,
          finalEmotion: 'happy',
          typingSpeed: NOTIFICATION_TYPING_SPEED,
          visibleDuration: NOTIFICATION_VISIBLE_DURATION
        })
      }
      active.messageTimer = null
    }, NOTIFICATION_MESSAGE_DELAY)
    active.messageTimer.unref()

    const totalDuration =
      NOTIFICATION_MESSAGE_DELAY +
      estimateNotificationTypingDuration(request.message) +
      NOTIFICATION_VISIBLE_DURATION +
      NOTIFICATION_EXIT_BUFFER
    active.completionTimer = setTimeout(() => {
      if (activePetNotification !== active) return
      activePetNotification = null
      deliverNextPetNotification()
    }, totalDuration)
    active.completionTimer.unref()
  }
  if (window.webContents.isLoadingMainFrame()) {
    window.webContents.once('did-finish-load', deliver)
  } else {
    deliver()
  }
}

const showPetNotification = (request: PetNotificationRequest): void => {
  if (request.kind !== 'schedule' && isFocusActive()) return

  if (
    request.kind === 'schedule' &&
    activePetNotification &&
    activePetNotification.request.kind !== 'schedule'
  ) {
    const interrupted = activePetNotification.request
    clearActiveNotificationTimers()
    activePetNotification = null
    const firstQueuedRepeating = pendingPetNotifications.findIndex(
      (item) => item.kind !== 'schedule'
    )
    if (firstQueuedRepeating >= 0) {
      pendingPetNotifications.splice(firstQueuedRepeating, 0, interrupted)
    } else {
      pendingPetNotifications.push(interrupted)
    }
  }

  const insertionIndex =
    request.kind === 'schedule'
      ? pendingPetNotifications.findIndex((item) => item.kind !== 'schedule')
      : -1
  if (insertionIndex >= 0) pendingPetNotifications.splice(insertionIndex, 0, request)
  else pendingPetNotifications.push(request)
  deliverNextPetNotification()
}

const isSameLocalDate = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate()

const buildTodayScheduleMessage = (): string => {
  const now = new Date()
  const todaySchedules = schedulesStore
    .get('schedules')
    .filter((schedule) => isSameLocalDate(new Date(schedule.startAt), now))
    .sort((left, right) => left.startAt.localeCompare(right.startAt))

  if (todaySchedules.length === 0) {
    return '오늘은 등록된 일정이 없어. 여유로운 하루 보내자!'
  }

  const visibleSchedules = todaySchedules.slice(0, 5)
  const scheduleLines = visibleSchedules.map((schedule) => {
    const time = new Date(schedule.startAt).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    })
    const completed = schedule.status === 'completed' ? ' (완료)' : ''
    return `${time} ${schedule.title}${completed}`
  })
  const hiddenCount = todaySchedules.length - visibleSchedules.length
  if (hiddenCount > 0) {
    scheduleLines.push(`그리고 ${hiddenCount}개가 더 있어.`)
  }
  return `오늘 일정은 ${todaySchedules.length}개야!\n${scheduleLines.join('\n')}`
}

const announceTodaySchedules = (): void => {
  if (!settingsStore.get('petEnabled')) return
  const window = ensurePetWindow()
  const deliver = (): void => {
    if (window.isDestroyed()) return
    window.webContents.send(IPC_CHANNELS.petMessageShown, {
      text: buildTodayScheduleMessage(),
      finalEmotion: 'happy',
      typingSpeed: 24,
      visibleDuration: 9_000
    })
  }
  if (window.webContents.isLoadingMainFrame()) {
    window.webContents.once('did-finish-load', deliver)
  } else {
    deliver()
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
    if (getGeminiKeyStatus().configured) showPet(true)
    else showOnboardingWindow()
  })

  void app.whenReady().then(() => {
    app.setAppUserModelId('com.example.desktoppetscheduler')
    registerFoundationIpc()
    notificationScheduler = new NotificationScheduler({
      notify: showPetNotification,
      isFocusActive
    })
    notificationScheduler.start()
    pomodoroTimer = new PomodoroTimerService({
      stateChanged: (state) => {
        if (state.mode === 'focus' && state.runState === 'running') {
          discardRepeatingPetNotifications()
        }
        broadcastPomodoroChanged(state)
      },
      phaseEvent: showPomodoroReaction
    })
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
      openHelp: openHelpWindow,
      openPomodoro: openPomodoroWindow,
      openTodos: openTodoWindow,
      openDiary: openDiaryWindow,
      quitApp
    })
    registerScheduleIpc({
      getTrustedWindows: () => [
        mainWindow,
        petWindow,
        scheduleDiaryWindow,
        settingsWindow,
        todoWindow,
        diaryWindow
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
    registerHolidayIpc({
      getTrustedWindows: () => [
        mainWindow,
        petWindow,
        scheduleDiaryWindow,
        settingsWindow
      ]
    })
    registerGeminiKeyIpc({
      getTrustedWindows: () => [
        mainWindow,
        petWindow,
        scheduleDiaryWindow,
        settingsWindow,
        helpWindow,
        pomodoroWindow
      ],
      completeOnboarding: () => {
        if (isWindowAlive(mainWindow)) mainWindow.close()
        if (settingsStore.get('petEnabled')) {
          showPet()
          showFirstWelcome()
        }
      },
      openSettings: openSettingsWindow
    })
    registerHelpIpc({
      getTrustedWindows: () => [
        mainWindow,
        petWindow,
        scheduleDiaryWindow,
        settingsWindow,
        helpWindow
      ],
      openHelp: openHelpWindow,
      closeHelp: closeHelpWindow
    })
    registerPomodoroIpc({
      getTrustedWindows: () => [
        mainWindow,
        petWindow,
        scheduleDiaryWindow,
        settingsWindow,
        helpWindow,
        pomodoroWindow
      ],
      timer: pomodoroTimer,
      openPomodoro: openPomodoroWindow,
      closePomodoro: closePomodoroWindow
    })
    registerTodoIpc({
      getTrustedWindows: () => [
        mainWindow,
        petWindow,
        scheduleDiaryWindow,
        settingsWindow,
        todoWindow,
        diaryWindow
      ],
      todosChanged: broadcastTodosChanged,
      todoCompleted: showTodoCompletionReaction,
      openTodos: openTodoWindow,
      closeTodos: closeTodoWindow
    })
    registerTodoConversationIpc({
      getPetWindow: () => petWindow,
      todosChanged: broadcastTodosChanged,
      todoCompleted: showTodoCompletionReaction
    })
    registerDiaryIpc({
      getTrustedWindows: () => [
        mainWindow,
        petWindow,
        scheduleDiaryWindow,
        todoWindow,
        diaryWindow
      ],
      openDiary: openDiaryWindow,
      closeDiary: closeDiaryWindow,
      diaryChanged: broadcastDiaryChanged
    })

    if (getGeminiKeyStatus().configured) {
      ensurePetWindow()
    } else {
      showOnboardingWindow()
    }
    appTray = createAppTray({
      isPetVisible: () => isWindowAlive(petWindow) && petWindow.isVisible(),
      showPet: () => showPet(),
      hidePet,
      openScheduleDiary: () => openScheduleDiary(false),
      openNewSchedule: () => openScheduleDiary(true),
      showFoundation: showFoundationWindow,
      openSettings: openSettingsWindow,
      openHelp: openHelpWindow,
      openPomodoro: openPomodoroWindow,
      openTodos: openTodoWindow,
      openDiary: openDiaryWindow,
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

    if (getGeminiKeyStatus().configured && settingsStore.get('petEnabled')) {
      showPet()
      const todayScheduleTimer = setTimeout(announceTodaySchedules, 1_200)
      todayScheduleTimer.unref()
    }

    app.on('activate', () => {
      if (getGeminiKeyStatus().configured) showPet()
      else showOnboardingWindow()
    })
  })

  app.on('before-quit', () => {
    isQuitting = true
    disposePetNotificationQueue()
    notificationScheduler?.dispose()
    pomodoroTimer?.dispose()
  })

  app.on('window-all-closed', () => {
    if (isQuitting) {
      app.quit()
    }
  })
}
