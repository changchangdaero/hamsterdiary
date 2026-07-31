// 사용자 설정을 settings.json에 저장하는 electron-store 인스턴스를 만드는 파일입니다.
import Store from 'electron-store'
import type { SettingsStoreData } from '../../shared/types/stores'
import { DEFAULT_REMINDER_SETTINGS } from '../../shared/types/notifications'

export const settingsStore = new Store<SettingsStoreData>({
  name: 'settings',
  defaults: {
    dataVersion: 1,
    petEnabled: true,
    alwaysOnTop: false,
    reminders: DEFAULT_REMINDER_SETTINGS
  }
})
