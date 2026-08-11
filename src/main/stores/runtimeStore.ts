// 실행 중 유지할 데이터를 runtime.json에 저장하는 electron-store 인스턴스를 만드는 파일입니다.
import Store from 'electron-store'
import type { RuntimeStoreData } from '../../shared/types/stores'
import { DEFAULT_POMODORO_SETTINGS } from '../../shared/types/pomodoro'

export const runtimeStore = new Store<RuntimeStoreData>({
  name: 'runtime',
  defaults: {
    dataVersion: 1,
    phase0Counter: 0,
    petPosition: null,
    petWindowLayoutVersion: 1,
    pomodoro: {
      mode: 'focus',
      runState: 'idle',
      remainingSeconds: DEFAULT_POMODORO_SETTINGS.focusMinutes * 60,
      endAt: null
    }
  }
})
