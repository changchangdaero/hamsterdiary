// 개발 및 패키징 환경에서 앱 리소스 경로를 일관되게 계산하는 파일입니다.
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { app } from 'electron'

export const getTrayIconPath = (): string =>
  app.isPackaged
    ? join(process.resourcesPath, 'tray-icon.png')
    : join(app.getAppPath(), 'resources', 'tray-icon.png')

export const getWindowIconPath = (): string | undefined => {
  const root = app.isPackaged
    ? process.resourcesPath
    : join(app.getAppPath(), 'resources')
  const candidates = [join(root, 'app-icon.ico'), join(root, 'window-icon.png')]
  return candidates.find(existsSync)
}
