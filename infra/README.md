# Hami AWS infrastructure

Terraform creates one HTTP API, one Lambda, one DynamoDB table, minimum IAM,
14-day metadata-only logs, alarms, SNS email notification, and an AWS infrastructure budget.

## Before apply

Build the backend and create both secrets outside Terraform so their values never enter state:

```powershell
npm.cmd --prefix ..\backend run build
aws ssm put-parameter --region ap-northeast-2 --name /hami/prod/ai-api-key --type SecureString --value "YOUR_API_KEY"
$hamiHashSecret = [guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()
aws ssm put-parameter --region ap-northeast-2 --name /hami/prod/installation-hash-secret --type SecureString --value $hamiHashSecret
```

Never commit the real `terraform.tfvars`, Terraform state, API key, or HMAC secret.
