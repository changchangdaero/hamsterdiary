// 펫 표시 상태와 앱 수명 주기를 제어하는 시스템 트레이를 생성하는 파일입니다.
import { Menu, Tray } from 'electron'
import { getTrayIconPath } from '../paths'

interface CreateAppTrayOptions {
  isPetVisible: () => boolean
  showPet: () => void
  hidePet: () => void
  openScheduleDiary: () => void
  openNewSchedule: () => void
  showFoundation: () => void
  openSettings: () => void
  openHelp: () => void
  quitApp: () => void
}

export interface AppTrayController {
  tray: Tray
  refreshMenu: () => void
}

export const createAppTray = (
  options: CreateAppTrayOptions
): AppTrayController => {
  const tray = new Tray(getTrayIconPath())
  tray.setToolTip('Desktop Pet Scheduler')

  const refreshMenu = (): void => {
    const isVisible = options.isPetVisible()
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: '일정 다이어리 열기',
          click: options.openScheduleDiary
        },
        {
          label: '새 일정 추가',
          click: options.openNewSchedule
        },
        { type: 'separator' },
        {
          label: '펫 표시',
          type: 'checkbox',
          checked: isVisible,
          click: () => {
            if (isVisible) {
              options.hidePet()
            } else {
              options.showPet()
            }
          }
        },
        { type: 'separator' },
        { label: '기반 확인 창 열기', click: options.showFoundation },
        { label: '설정', click: options.openSettings },
        { label: '도움말', click: options.openHelp },
        {
          label: '앱 종료',
          click: options.quitApp
        }
      ])
    )
  }

  tray.on('click', () => {
    if (options.isPetVisible()) {
      options.hidePet()
    } else {
      options.showPet()
    }
  })
  refreshMenu()

  return { tray, refreshMenu }
}
