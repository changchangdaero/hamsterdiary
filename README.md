# Desktop Pet Scheduler — 구간 0

Electron, React, TypeScript, electron-store 기반 데스크톱 펫 일정 앱의 최소 기반입니다.
이 구간은 일반 테스트 창, 저장소, IPC 보안 경계, 단일 인스턴스, Windows 패키징만 검증합니다.

## 환경

- Windows 11 x64 우선
- Node.js `24.13.1` (`.nvmrc`)
- npm `11.8.0`

## 실행

```powershell
npm.cmd install
npm.cmd run dev
```

PowerShell 실행 정책에서 `npm.ps1`이 차단될 수 있으므로 이 문서에서는 `npm.cmd`를 사용합니다.

## 검증

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run build:win
```

화면에서 **카운터 1 증가**를 누르고 앱을 종료한 다음 다시 실행해 값이 유지되는지 확인합니다.
동시에 앱을 두 번 실행하면 두 번째 프로세스는 새 창을 만들지 않고 기존 창을 복원해 앞으로 가져옵니다.

Windows 패키징 결과는 `dist/` 아래에 생성됩니다.
