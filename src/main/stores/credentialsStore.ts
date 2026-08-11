import Store from 'electron-store'
import type { CredentialsStoreData } from '../../shared/types/stores'

export const credentialsStore = new Store<CredentialsStoreData>({
  name: 'credentials',
  defaults: {
    dataVersion: 1,
    geminiApiKey: null
  }
})

