// 향후 일정 데이터를 schedules.json에 저장할 electron-store 인스턴스를 만드는 파일입니다.
import Store from 'electron-store'
import type { SchedulesStoreData } from '../../shared/types/stores'

export const schedulesStore = new Store<SchedulesStoreData>({
  name: 'schedules',
  defaults: {
    dataVersion: 1,
    schedules: []
  }
})
