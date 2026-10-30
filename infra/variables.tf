variable "aws_region" {
  description = "Hami backend AWS region"
  type        = string
  default     = "ap-northeast-2"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
}

variable "alert_email" {
  description = "Email that receives CloudWatch and AWS Budget alerts"
  type        = string

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.alert_email))
    error_message = "alert_email must be a valid email address."
  }
}

variable "ai_api_key_parameter_name" {
  description = "SSM SecureString path for the AI API key"
  type        = string
  default     = "/hami/prod/ai-api-key"
}

variable "hash_secret_parameter_name" {
  description = "SSM SecureString path for installation ID HMAC secret"
  type        = string
  default     = "/hami/prod/installation-hash-secret"
}

variable "ai_base_url" {
  description = "OpenAI-compatible API base URL"
  type        = string
  default     = "https://api.openai.com/v1"
}

variable "ai_model" {
  description = "OpenAI-compatible chat completion model"
  type        = string
  default     = "gpt-5-nano"
}

# Usage limits per installation. Change these in terraform.tfvars and apply.
variable "daily_request_limit" {
  description = "AI chats one installation may send per day"
  type        = number
  default     = 10

  validation {
    condition     = var.daily_request_limit >= 1 && floor(var.daily_request_limit) == var.daily_request_limit
    error_message = "daily_request_limit must be a whole number of at least 1."
  }
}

variable "monthly_request_limit" {
  description = "AI chats one installation may send per month"
  type        = number
  default     = 60

  validation {
    condition     = floor(var.monthly_request_limit) == var.monthly_request_limit && var.monthly_request_limit >= var.daily_request_limit
    error_message = "monthly_request_limit must be a whole number no smaller than daily_request_limit."
  }
}

# Whole-service AI budget, estimated from token usage by the Lambda.
variable "monthly_budget_krw" {
  description = "Planned monthly AI spend in KRW; cost alarms fire at 50% and 80% of it"
  type        = number
  default     = 30000

  validation {
    condition     = var.monthly_budget_krw >= 1000
    error_message = "monthly_budget_krw must be at least 1000."
  }
}

variable "budget_cutoff_krw" {
  description = "Estimated monthly AI spend in KRW at which the Lambda stops calling the AI"
  type        = number
  default     = 27000

  validation {
    condition     = var.budget_cutoff_krw > 0 && var.budget_cutoff_krw <= var.monthly_budget_krw
    error_message = "budget_cutoff_krw must be positive and no larger than monthly_budget_krw."
  }
}

variable "usd_krw_rate" {
  description = "Conservative exchange rate used by the application budget breaker"
  type        = number
  default     = 1500
}

# Provider list prices used for the cost estimate. Check them before each deploy.
variable "input_usd_per_million_tokens" {
  description = "AI input token price in USD per 1M tokens"
  type        = number
  default     = 0.05
}

variable "output_usd_per_million_tokens" {
  description = "AI output token price in USD per 1M tokens"
  type        = number
  default     = 0.4
}

variable "lambda_reserved_concurrency" {
  description = "Concurrent executions reserved for the AI proxy; null leaves it unreserved and relies on API Gateway throttling"
  type        = number
  default     = null

  # AWS keeps at least 10 executions unreserved per account, so accounts with
  # the default limit of 10 cannot reserve any.
  validation {
    condition     = var.lambda_reserved_concurrency == null || try(var.lambda_reserved_concurrency >= 1, false)
    error_message = "lambda_reserved_concurrency must be null or at least 1."
  }
}

variable "aws_monthly_budget_usd" {
  description = "Separate AWS infrastructure monthly budget alert"
  type        = number
  default     = 5
}
