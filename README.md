# Hami

**일정부터 하루 기록까지 함께하는 데스크톱 친구**

Hami는 Electron, React, TypeScript로 만든 Windows 데스크톱 앱이다. 일정,
할 일, 일기와 뽀모도로 데이터는 사용자 PC에만 저장하고, 사용자가 대화창에
직접 입력한 AI 대화만 별도 AWS 백엔드로 전송한다.

## 저장소 구성

```text
src/       Electron 데스크톱 앱
backend/   독립적으로 빌드되는 AWS Lambda
infra/     AWS 리소스를 관리하는 Terraform
```

Git 저장소는 하나지만 데스크톱 앱과 Lambda는 서로 다른 실행·배포 단위다.
Electron 패키지에는 `out/`만 포함되므로 `backend/`, `infra/`, Terraform state와
비밀값은 들어가지 않는다.

## 데스크톱 앱

요구 환경은 Windows 11 x64, Node.js 24.13.1, npm 11.8.0이다.

배포된 Terraform의 `chat_api_url` 값을 `.env`에 설정한다.

```dotenv
MAIN_VITE_HAMI_CHAT_API_URL=https://example.execute-api.ap-northeast-2.amazonaws.com/v1/chat
```

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run typecheck
npm.cmd run build
npm.cmd run build:win
```

AI URL이 비어 있으면 로컬 기능은 정상 작동하고 AI 대화만 준비 중 안내를 표시한다.

## 백엔드

백엔드는 `POST /v1/chat` 하나만 제공한다. 회원가입 없이 앱 설치 UUID를 서버
비밀값으로 HMAC 처리해 사용량만 구분한다.

- 설치당 하루 10회, 월 60회
- 전체 AI 월 예산 30,000원
- 27,000원 상당에서 안전 차단
- 대화 원문과 AI 답변 원문 미저장
- 일정, 할 일, 일기, 뽀모도로 데이터 미전송
- DynamoDB에는 해시 ID, 횟수, 토큰, 추정 비용과 TTL만 저장

```powershell
npm.cmd --prefix backend install
npm.cmd --prefix backend run check
```

## AWS와 Terraform

Terraform 관리 범위는 API Gateway HTTP API, Lambda 1개, DynamoDB 1개,
최소 IAM, CloudWatch 로그·경보, SNS 이메일 알림과 AWS Budget이다.

AI API 키와 설치 ID HMAC 비밀값은 Terraform에 전달하지 않는다. 배포 전에
SSM Parameter Store SecureString으로 별도 등록한다. 자세한 명령과 적용 순서는
`infra/README.md`에 있다.

## 개인정보 경계

AI 대화 사용 시 현재 메시지와 최근 대화 최대 5개만 외부 AI로 전달한다.
Lambda와 API Gateway에는 요청·응답 본문을 기록하지 않는다. 사용자가 일기 내용을
직접 대화창에 붙여 넣으면 그 내용은 대화 메시지로 전송될 수 있다.
