import Store from 'electron-store'
import type { HolidaysStoreData } from '../../shared/types/stores'

export const holidaysStore = new Store<HolidaysStoreData>({
  name: 'holidays',
  defaults: {
    dataVersion: 1,
    years: {}
  }
})

