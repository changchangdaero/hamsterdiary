locals {
  name = "hami-${var.environment}"

  # Cost alarms warn at half and at 80% of the planned monthly AI budget.
  cost_alarm_thresholds_krw = {
    half   = floor(var.monthly_budget_krw * 0.5)
    urgent = floor(var.monthly_budget_krw * 0.8)
  }

  common_environment = {
    USAGE_TABLE_NAME              = aws_dynamodb_table.usage.name
    AI_API_KEY_PARAMETER_NAME     = aws_ssm_parameter.ai_api_key.name
    HASH_SECRET_PARAMETER_NAME    = aws_ssm_parameter.installation_hash_secret.name
    AI_BASE_URL                   = var.ai_base_url
    AI_MODEL                      = var.ai_model
    DAILY_REQUEST_LIMIT           = tostring(var.daily_request_limit)
    MONTHLY_REQUEST_LIMIT         = tostring(var.monthly_request_limit)
    MONTHLY_BUDGET_KRW            = tostring(var.monthly_budget_krw)
    BUDGET_CUTOFF_KRW             = tostring(var.budget_cutoff_krw)
    USD_KRW_RATE                  = tostring(var.usd_krw_rate)
    INPUT_USD_PER_MILLION_TOKENS  = tostring(var.input_usd_per_million_tokens)
    OUTPUT_USD_PER_MILLION_TOKENS = tostring(var.output_usd_per_million_tokens)
    # These match the desktop app's request limits; change both together.
    MAX_MESSAGE_LENGTH         = "1000"
    MAX_HISTORY_ITEMS          = "5"
    MAX_REQUEST_COST_MICRO_USD = "20000"
    AI_REQUEST_TIMEOUT_MS      = "25000"
  }
}
