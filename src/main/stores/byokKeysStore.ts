// 내 API 키(BYOK)를 OS 암호화(safeStorage)로 감싼 값만 byok-keys.json에 저장하는 저장소입니다.
import Store from 'electron-store'
import type { ByokKeysStoreData } from '../../shared/types/stores'

export const byokKeysStore = new Store<ByokKeysStoreData>({
  name: 'byok-keys',
  defaults: {
    dataVersion: 1,
    keys: {}
  }
})
