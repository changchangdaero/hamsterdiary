# Terraform owns the secret parameters but never their real values: it creates
# them with a placeholder, and the real values are written afterwards with
# `aws ssm put-parameter --overwrite`. ignore_changes keeps later applies from
# resetting them, so state only ever holds the placeholder.
locals {
  secret_placeholder = "SET_WITH_AWS_CLI"
}

resource "aws_ssm_parameter" "ai_api_key" {
  name        = var.ai_api_key_parameter_name
  description = "Hami AI provider API key (value set outside Terraform)"
  type        = "SecureString"
  value       = local.secret_placeholder

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "installation_hash_secret" {
  name        = var.hash_secret_parameter_name
  description = "HMAC secret for hashing installation IDs (value set outside Terraform)"
  type        = "SecureString"
  value       = local.secret_placeholder

  lifecycle {
    ignore_changes = [value]
  }
}
