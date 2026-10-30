// 사용자 설정을 settings.json에 저장하는 electron-store 인스턴스를 만드는 파일입니다.
import Store from 'electron-store'
import type { SettingsStoreData } from '../../shared/types/stores'
import { DEFAULT_REMINDER_SETTINGS } from '../../shared/types/notifications'
import { DEFAULT_POMODORO_SETTINGS } from '../../shared/types/pomodoro'
import { DEFAULT_PET_BEHAVIOR_SETTINGS } from '../../shared/types/pet'

export const settingsStore = new Store<SettingsStoreData>({
  name: 'settings',
  defaults: {
    dataVersion: 1,
    petEnabled: true,
    alwaysOnTop: false,
    onboardingWelcomeShown: false,
    reminders: DEFAULT_REMINDER_SETTINGS,
    pomodoro: DEFAULT_POMODORO_SETTINGS,
    petBehavior: DEFAULT_PET_BEHAVIOR_SETTINGS
  }
})
