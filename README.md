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

## 구간 1 — 데스크톱 펫 창과 트레이

구간 1은 220×260 크기의 투명하고 프레임 없는 펫 창, 기본 햄스터 이미지,
마지막 위치 복원, 수동 드래그, 투명 영역 클릭 통과, 시스템 트레이를 추가합니다.
기반 확인 화면과 세 electron-store 저장소, 단일 인스턴스 및 IPC 보안 설정은
구간 0 구조를 유지합니다.

### 실행과 패키징

```powershell
npm.cmd run dev
npm.cmd run typecheck
npm.cmd run build
npm.cmd run build:win
```

Windows x64 설치 파일과 portable 실행 파일은 `dist/`에 생성됩니다.

### 사용 방법

- 앱을 시작하면 `settings.json`의 `petEnabled`가 `true`일 때 펫이 먼저
  표시됩니다.
- 햄스터 위에서 마우스 왼쪽 버튼을 누르고 5px 이상 움직이면 펫을
  드래그할 수 있습니다. 짧은 클릭에는 아직 동작이 없습니다.
- 펫 주변의 투명 영역은 마우스 클릭이 뒤쪽 앱으로 전달됩니다. 햄스터
  hitbox 위에서만 펫 창의 입력이 활성화됩니다.
- 트레이 메뉴의 **펫 표시**와 **펫 숨기기**로 표시 상태를 바꿀 수
  있습니다. 트레이 아이콘을 왼쪽 클릭해도 표시 상태가 토글됩니다.
- **기반 확인 창 열기**에서 구간 0 상태 화면과 `phase0Counter` 저장 기능을
  확인할 수 있습니다.
- 앱을 완전히 끝내려면 창을 닫는 대신 트레이 메뉴의 **앱 종료**를
  사용합니다.

펫 위치는 Electron 사용자 데이터 디렉터리의 `runtime.json`에
`petPosition: { x, y }` 형태로 저장됩니다. 이동 중에는 저장하지 않고
드래그가 끝났을 때 한 번만 저장합니다. 저장 좌표가 잘못됐거나 현재
모니터 작업 영역과 펫 창의 25% 이상 겹치지 않으면 주 모니터 작업 영역
우측 하단 20px 여백 위치로 복원합니다. 표시 여부는 같은 디렉터리의
`settings.json` 내 `petEnabled`에 저장됩니다.

### 수동 검증 체크리스트

- [ ] 투명 배경에 햄스터 이미지만 보이며 창 프레임과 작업표시줄 항목이 없다.
- [ ] 첫 실행 시 주 모니터 작업 영역 우측 하단에 표시된다.
- [ ] 투명 영역을 통해 뒤쪽 앱을 클릭할 수 있고 햄스터 위에서는 입력된다.
- [ ] 햄스터를 드래그할 수 있고 재실행 후 마지막 위치가 복원된다.
- [ ] 트레이에서 숨김·표시, 기반 확인 창 열기, 앱 종료가 동작한다.
- [ ] 숨김 상태가 재실행 후 유지되고 두 번 실행해도 펫과 트레이가 하나다.
- [ ] 기반 확인 창에서 `phase0Counter`를 저장하고 재실행 후 조회할 수 있다.
- [ ] 개발자 콘솔에 지속적인 오류나 Electron 보안 경고가 없다.

감정 상태와 애니메이션, 말풍선, 펫 클릭 일정 입력, 일정 관리, LLM,
알림 스케줄러, 자동 시작과 자동 업데이트는 아직 구현하지 않았습니다.

## 구간 2 — 감정 표현과 말풍선

구간 2는 펫 창을 360×420으로 확장하고 기존 200×200 햄스터 표시 크기를
유지하면서 상단에 CSS 말풍선 영역을 추가합니다. 기존 220×260 창 위치는
하단 중앙의 햄스터 위치가 유지되도록 한 번 변환하며,
`runtime.json`의 `petWindowLayoutVersion`이 2가 되면 다시 변환하지 않습니다.

### 이미지와 감정

`src/renderer/src/assets/pets/`의 투명 PNG 감정 프레임을 사용합니다.

- `idle.png`: 기본 상태와 말하기의 닫힌 입 프레임
- `sleep.png`: idle 내부의 눈 감기 프레임이자 sleep 순환의 첫 프레임
- `talking.png`: 타자기 출력 중 열린 입 프레임
- `question.png`, `sad.png`, `thumbs-up.png`, `happy.png`: 각 감정 프레임
- `sleep-z1.png`, `sleep-z2.png`, `sleep-z3.png`: `sleep` 다음에 이어지는 Z 순환 프레임

감정 상태는 `idle`, `talking`, `question`, `sad`, `sleep`, `thumbsUp`,
`happy` 7종입니다. 앱 시작 시 이미지 10장을 미리 불러옵니다. idle은
2.9초의 미세한 호흡과 3.5~7초 사이의 랜덤 blink를 사용합니다. 타이핑
중에는 165ms 간격으로 idle/talking 프레임을 교체하고, sleep은 575ms
간격으로 `sleep→sleep-z1→sleep-z2→sleep-z3`를 반복합니다.

question은 짧은 갸웃, sad와 sleep은 느린 호흡, thumbsUp은 한 번의 팝,
happy는 짧은 바운스 후 정지하는 CSS 애니메이션을 사용합니다. 위치 중앙
정렬은 `.pet-stage`, 감정 transform은 `.pet-motion-wrapper`가 각각
담당합니다.

### 말풍선과 타자기

말풍선은 이미지 없이 둥근 미색 배경, 갈색 테두리와 CSS 꼬리로
렌더링합니다. 텍스트는 `Intl.Segmenter`의 한글 grapheme 단위로 기본
28ms마다 출력하며 쉼표, 문장 종결 부호와 줄바꿈에는 추가 지연을 둡니다.
이모지와 결합 문자도 한 단위로 처리합니다.

타이핑 중 말풍선을 클릭하거나 키보드로 활성화하면 문장이 즉시
완성되고 입 프레임도 닫힙니다. 지정한 유지 시간이 지나면 말풍선이
짧게 사라지고 idle로 돌아갑니다. 새 메시지는 이전 메시지를 교체하며
queue는 사용하지 않습니다.

### Foundation 테스트 패널

트레이에서 **기반 확인 창 열기**를 선택하면 다음을 시험할 수 있습니다.

- idle, question, sad, sleep, thumbsUp, happy 감정 버튼
- 최대 200자의 사용자 정의 메시지와 타이핑 후 감정
- 말풍선 표시 및 숨기기
- 기본 알림, 질문 알림, 일정 완료 알림 빠른 테스트

메시지는 foundation renderer에서 펫 renderer로 직접 보내지 않고
preload → 검증된 main IPC → 펫 renderer 순서로 전달됩니다. 숨겨진 펫에
감정이나 메시지를 보내면 `petEnabled`를 켜고 포커스를 빼앗지 않는
방식으로 펫을 표시합니다.

### 펫 우클릭 메뉴

햄스터 이미지 위에서 우클릭하면 네이티브 메뉴가 열립니다. 아직 범위에
포함되지 않은 **일정 다이어리 열기**, **새 일정 추가**, **설정**은
비활성화되어 있습니다. **펫 숨기기**는 펫 창만 숨기고 트레이는
유지하며, **앱 종료**는 앱을 완전히 종료합니다. 말풍선이나 투명 영역의
우클릭은 펫 메뉴를 열지 않습니다.

### 구간 2 수동 검증

```powershell
npm.cmd run dev
npm.cmd run typecheck
npm.cmd run build
npm.cmd run build:win
```

- [ ] idle↔blink와 idle↔talking 교체 시 본체 위치와 크기가 변하지 않는다.
- [ ] sleep Z가 1→2→3→2 순서로 움직이고 장식이 잘리지 않는다.
- [ ] question, sad, thumbsUp, happy 상태와 CSS 움직임이 과하지 않다.
- [ ] 한글과 이모지가 grapheme 단위로 출력되고 말풍선 클릭 시 완성된다.
- [ ] 말풍선 및 펫 이외의 투명 영역은 뒤쪽 앱의 클릭을 막지 않는다.
- [ ] 말풍선 클릭은 드래그를 시작하지 않고 펫 드래그는 정상 동작한다.
- [ ] 펫 우클릭 메뉴의 순서, disabled 항목, 숨기기와 종료가 정상이다.
- [ ] 기존 위치가 한 번만 변환되고 재실행 후 위치가 유지된다.
- [ ] 트레이, foundation 카운터, 저장소와 단일 인스턴스가 유지된다.
- [ ] Windows x64 패키징 앱에서도 같은 동작을 보인다.

일정 창과 일정 CRUD, LLM 자연어 파싱, 실제 알림 스케줄러, safeStorage,
자동 시작·업데이트, 음성·사운드와 메시지 queue는 아직 구현하지 않았습니다.
