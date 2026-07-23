// main, preload, renderer가 사용하는 IPC 채널 이름을 한곳에서 관리하는 파일입니다.
export const IPC_CHANNELS = {
  getFoundationStatus: 'foundation:get-status',
  incrementPhase0Counter: 'foundation:increment-counter',
  setPetMouseInteractive: 'pet:set-mouse-interactive',
  beginPetDrag: 'pet:begin-drag',
  movePetDrag: 'pet:move-drag',
  endPetDrag: 'pet:end-drag'
} as const
