// 구간 0 IPC 채널 이름을 한곳에서 안전하게 관리하는 파일입니다.
export const IPC_CHANNELS = {
  getFoundationStatus: 'foundation:get-status',
  incrementPhase0Counter: 'foundation:increment-counter'
} as const
