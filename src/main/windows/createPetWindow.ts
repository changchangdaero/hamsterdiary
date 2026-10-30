// 투명한 데스크톱 펫 BrowserWindow를 생성하고 renderer 화면을 불러오는 파일입니다.
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import type { PetPosition } from '../../shared/types/stores'
import { PET_WINDOW_SIZE } from './petPosition'
import { getWindowIconPath } from '../paths'

interface CreatePetWindowOptions {
  position: PetPosition
  shouldShow: () => boolean
}

export const createPetWindow = ({
  position,
  shouldShow
}: CreatePetWindowOptions): BrowserWindow => {
  const petWindow = new BrowserWindow({
    icon: getWindowIconPath(),
    ...PET_WINDOW_SIZE,
    x: position.x,
    y: position.y,
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
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  petWindow.setIgnoreMouseEvents(true, { forward: true })
  petWindow.once('ready-to-show', () => {
    if (shouldShow() && !petWindow.isDestroyed()) {
      petWindow.showInactive()
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    const rendererUrl = new URL(process.env.ELECTRON_RENDERER_URL)
    rendererUrl.searchParams.set('window', 'pet')
    void petWindow.loadURL(rendererUrl.toString())
  } else {
    void petWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { window: 'pet' }
    })
  }

  return petWindow
}
