// renderer의 window 객체에 노출된 최소 preload API 타입을 선언하는 파일입니다.
import type { DesktopPetAPI } from '../shared/types/foundation'

declare global {
  interface Window {
    desktopPetAPI: DesktopPetAPI
  }
}

export {}
