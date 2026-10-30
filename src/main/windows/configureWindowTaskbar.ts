import { nativeImage, type BrowserWindow } from 'electron'
import { getWindowIconPath } from '../paths'

const APP_USER_MODEL_ID = 'com.desktop.pet.scheduler'

export const configureWindowTaskbar = (window: BrowserWindow): void => {
  if (process.platform !== 'win32') return

  const executablePath =
    process.env.PORTABLE_EXECUTABLE_FILE?.trim() || process.execPath
  const iconPath = getWindowIconPath()
  if (!iconPath) {
    console.warn('[window:taskbar] icon resource not found; using executable default')
    return
  }

  const icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) {
    console.warn('[window:taskbar] icon resource could not be decoded; using executable default', {
      iconPath
    })
    return
  }

  try {
    window.setIcon(icon)
    window.setAppDetails({
      appId: APP_USER_MODEL_ID,
      appIconPath: iconPath,
      appIconIndex: 0,
      relaunchCommand: `"${executablePath}"`,
      relaunchDisplayName: 'Hami'
    })
  } catch (error) {
    console.warn('[window:taskbar] custom icon setup failed; using executable default', {
      errorType: error instanceof Error ? error.name : 'UnknownError'
    })
  }
}
