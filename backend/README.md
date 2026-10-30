# Hami backend

AI 대화를 중계하고 익명 설치 단위 사용량과 전체 예산을 제한하는 AWS Lambda 프로젝트다.
대화 원문과 AI 답변은 DynamoDB 또는 CloudWatch에 저장하지 않는다.

## Commands

```powershell
npm install
npm run check
```

실제 AI API 키와 설치 ID HMAC 비밀값은 Terraform state에 넣지 않고 배포 후 SSM
Parameter Store의 SecureString 값으로 별도 등록한다.
