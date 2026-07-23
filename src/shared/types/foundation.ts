// 구간 0에서 main, preload, renderer가 주고받는 데이터 타입을 정의하는 파일입니다.
import type {
  RuntimeStoreData,
  SchedulesStoreData,
  SettingsStoreData
} from './stores'
import type {
  PetEmotion,
  PetDragMovePayload,
  PetMessagePayload,
  ResolvedPetMessage
} from './pet'

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
  beginPetDrag: (payload: PetDragMovePayload) => void
  movePetDrag: (payload: PetDragMovePayload) => void
  endPetDrag: () => void
  setPetEmotion: (emotion: PetEmotion) => Promise<void>
  showPetMessage: (payload: PetMessagePayload) => Promise<void>
  hidePetMessage: () => Promise<void>
  showPetContextMenu: () => void
  onPetEmotionChanged: (listener: (emotion: PetEmotion) => void) => () => void
  onPetMessageShown: (
    listener: (message: ResolvedPetMessage) => void
  ) => () => void
  onPetMessageHidden: (listener: () => void) => () => void
  onPetWindowHidden: (listener: () => void) => () => void
}
