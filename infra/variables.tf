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
}

variable "ai_api_key_parameter_name" {
  description = "Existing SSM SecureString path for the AI API key"
  type        = string
  default     = "/hami/prod/ai-api-key"
}

variable "hash_secret_parameter_name" {
  description = "Existing SSM SecureString path for installation ID HMAC secret"
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

variable "usd_krw_rate" {
  description = "Conservative exchange rate used by the application budget breaker"
  type        = number
  default     = 1500
}

variable "lambda_reserved_concurrency" {
  description = "Maximum concurrent AI proxy executions"
  type        = number
  default     = 5
}

variable "aws_monthly_budget_usd" {
  description = "Separate AWS infrastructure monthly budget alert"
  type        = number
  default     = 5
}
