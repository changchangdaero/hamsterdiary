// 세 electron-store 파일에 저장되는 데이터 구조를 정의하는 파일입니다.
export interface PetPosition {
  x: number
  y: number
}

export interface SettingsStoreData {
  dataVersion: number
  petEnabled: boolean
  alwaysOnTop: boolean
}

export interface SchedulesStoreData {
  dataVersion: number
  schedules: []
}

export interface RuntimeStoreData {
  dataVersion: number
  phase0Counter: number
  petPosition: PetPosition | null
}
