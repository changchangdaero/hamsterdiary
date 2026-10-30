terraform {
  required_version = ">= 1.10.0"

  # State lives in the bucket made by infra/bootstrap. Bucket and key come from
  # backend.hcl (see backend.hcl.example) so the account ID stays out of git:
  #   terraform init -backend-config=backend.hcl
  # use_lockfile makes S3 itself block two applies from running at once.
  backend "s3" {
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}
