// 구간 0에서 main, preload, renderer가 주고받는 데이터 타입을 정의하는 파일입니다.
import type {
  RuntimeStoreData,
  SchedulesStoreData,
  SettingsStoreData
} from './stores'

export interface RuntimeVersions {
  electron: string
  chrome: string
  node: string
}

export interface FoundationStatus {
  versions: RuntimeVersions
  stores: {
    settings: SettingsStoreData
    schedules: SchedulesStoreData
    runtime: RuntimeStoreData
  }
}

export interface DesktopPetAPI {
  getFoundationStatus: () => Promise<FoundationStatus>
  incrementPhase0Counter: () => Promise<FoundationStatus>
  setPetMouseInteractive: (interactive: boolean) => void
  beginPetDrag: (screenX: number, screenY: number) => void
  movePetDrag: (screenX: number, screenY: number) => void
  endPetDrag: () => void
}
