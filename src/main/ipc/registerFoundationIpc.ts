// 구간 0 상태 조회와 카운터 증가 IPC 핸들러를 등록하는 파일입니다.
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcChannels'
import type { FoundationStatus } from '../../shared/types/foundation'
import { runtimeStore, schedulesStore, settingsStore } from '../stores'

const readFoundationStatus = (): FoundationStatus => ({
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  stores: {
    settings: { ...settingsStore.store },
    schedules: { ...schedulesStore.store },
    runtime: { ...runtimeStore.store }
  }
})

const assertNoArguments = (args: unknown[]): void => {
  if (args.length !== 0) {
    throw new Error('이 요청은 전달값을 허용하지 않습니다.')
  }
}

const toSafeIpcError = (error: unknown): Error => {
  if (error instanceof Error && error.message === '이 요청은 전달값을 허용하지 않습니다.') {
    return error
  }

  return new Error('요청을 처리하지 못했습니다.')
}

export const registerFoundationIpc = (): void => {
  ipcMain.handle(IPC_CHANNELS.getFoundationStatus, (_event, ...args: unknown[]) => {
    try {
      assertNoArguments(args)
      return readFoundationStatus()
    } catch (error) {
      throw toSafeIpcError(error)
    }
  })

  ipcMain.handle(IPC_CHANNELS.incrementPhase0Counter, (_event, ...args: unknown[]) => {
    try {
      assertNoArguments(args)
      const currentCounter = runtimeStore.get('phase0Counter')

      if (!Number.isSafeInteger(currentCounter) || currentCounter < 0) {
        throw new Error('저장된 카운터 값이 올바르지 않습니다.')
      }

      runtimeStore.set('phase0Counter', currentCounter + 1)
      return readFoundationStatus()
    } catch (error) {
      throw toSafeIpcError(error)
    }
  })
}
