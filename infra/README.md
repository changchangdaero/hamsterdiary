# Hami AWS infrastructure

Terraform creates one HTTP API, one Lambda, one DynamoDB table, minimum IAM,
two SSM SecureString parameters, 14-day metadata-only logs, alarms, SNS email
notification, and an AWS infrastructure budget.

## Layout

- `bootstrap/` makes the S3 bucket that stores this stack's state. Apply it once;
  its own small state stays local (git-ignored).
- This folder is the Hami backend stack. Its state lives in that bucket, locked
  with S3 native locking (`use_lockfile`).

## First deploy

```powershell
# 1. State bucket (once)
terraform -chdir=bootstrap init
terraform -chdir=bootstrap apply

# 2. Local config (both files are git-ignored)
Copy-Item backend.hcl.example backend.hcl        # set bucket to the bootstrap output
Copy-Item terraform.tfvars.example terraform.tfvars

# 3. Backend stack
npm.cmd --prefix ..\backend run build
terraform init -backend-config=backend.hcl
terraform plan -out=hami.tfplan
terraform apply hami.tfplan
```

## Secrets

Terraform creates both SSM parameters with a placeholder value and ignores later
value changes, so real secrets never enter state. Set them right after the first
apply, before anything calls the API:

```powershell
aws ssm put-parameter --region ap-northeast-2 --name /hami/prod/ai-api-key --type SecureString --overwrite --value "YOUR_API_KEY"
$hamiHashSecret = [guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()
aws ssm put-parameter --region ap-northeast-2 --name /hami/prod/installation-hash-secret --type SecureString --overwrite --value $hamiHashSecret
```

The Lambda caches secrets per warm instance; after rotating a value, redeploy or
wait for new instances.

## Changing limits

Edit `terraform.tfvars` (daily/monthly limits, budget, cutoff, token prices) and
run `terraform plan` / `apply`. Cost alarms follow `monthly_budget_krw`.

Never commit the real `terraform.tfvars`, `backend.hcl`, Terraform state, API key, or HMAC secret.
