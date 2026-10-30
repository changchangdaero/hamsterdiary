locals {
  name = "hami-${var.environment}"
  common_environment = {
    USAGE_TABLE_NAME             = aws_dynamodb_table.usage.name
    AI_API_KEY_PARAMETER_NAME    = var.ai_api_key_parameter_name
    HASH_SECRET_PARAMETER_NAME   = var.hash_secret_parameter_name
    AI_BASE_URL                  = var.ai_base_url
    AI_MODEL                     = var.ai_model
    DAILY_REQUEST_LIMIT          = "10"
    MONTHLY_REQUEST_LIMIT        = "60"
    MONTHLY_BUDGET_KRW           = "30000"
    BUDGET_CUTOFF_KRW            = "27000"
    USD_KRW_RATE                 = tostring(var.usd_krw_rate)
    MAX_MESSAGE_LENGTH           = "1000"
    MAX_HISTORY_ITEMS            = "5"
    MAX_REQUEST_COST_MICRO_USD   = "20000"
    INPUT_USD_PER_MILLION_TOKENS = "0.05"
    OUTPUT_USD_PER_MILLION_TOKENS = "0.4"
    AI_REQUEST_TIMEOUT_MS        = "25000"
  }
}
