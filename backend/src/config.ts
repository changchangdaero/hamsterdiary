const integer = (name: string, fallback: number): number => {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} 환경변수가 올바르지 않습니다.`)
  }
  return value
}

const number = (name: string, fallback: number): number => {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} 환경변수가 올바르지 않습니다.`)
  }
  return value
}

const required = (name: string): string => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`)
  return value
}

export interface AppConfig {
  tableName: string
  aiApiKeyParameterName: string
  hashSecretParameterName: string
  aiBaseUrl: string
  aiModel: string
  // Reasoning models spend completion tokens on hidden thinking; empty means the model default.
  aiReasoningEffort: string
  maxCompletionTokens: number
  dailyRequestLimit: number
  monthlyRequestLimit: number
  monthlyBudgetKrw: number
  budgetCutoffKrw: number
  usdKrwRate: number
  maxMessageLength: number
  maxHistoryItems: number
  maxRequestCostMicroUsd: number
  inputUsdPerMillionTokens: number
  outputUsdPerMillionTokens: number
  requestTimeoutMs: number
}

export const loadConfig = (): AppConfig => ({
  tableName: required('USAGE_TABLE_NAME'),
  aiApiKeyParameterName: required('AI_API_KEY_PARAMETER_NAME'),
  hashSecretParameterName: required('HASH_SECRET_PARAMETER_NAME'),
  aiBaseUrl: process.env.AI_BASE_URL?.trim() || 'https://api.openai.com/v1',
  aiModel: process.env.AI_MODEL?.trim() || 'gpt-5-nano',
  aiReasoningEffort: process.env.AI_REASONING_EFFORT?.trim() ?? '',
  maxCompletionTokens: integer('AI_MAX_COMPLETION_TOKENS', 160),
  dailyRequestLimit: integer('DAILY_REQUEST_LIMIT', 30),
  monthlyRequestLimit: integer('MONTHLY_REQUEST_LIMIT', 300),
  monthlyBudgetKrw: integer('MONTHLY_BUDGET_KRW', 30_000),
  budgetCutoffKrw: integer('BUDGET_CUTOFF_KRW', 27_000),
  usdKrwRate: number('USD_KRW_RATE', 1_500),
  maxMessageLength: integer('MAX_MESSAGE_LENGTH', 1_000),
  maxHistoryItems: integer('MAX_HISTORY_ITEMS', 5),
  maxRequestCostMicroUsd: integer('MAX_REQUEST_COST_MICRO_USD', 20_000),
  inputUsdPerMillionTokens: number('INPUT_USD_PER_MILLION_TOKENS', 0.05),
  outputUsdPerMillionTokens: number('OUTPUT_USD_PER_MILLION_TOKENS', 0.4),
  requestTimeoutMs: integer('AI_REQUEST_TIMEOUT_MS', 25_000)
})

export const budgetCutoffMicroUsd = (config: AppConfig): number =>
  Math.floor((config.budgetCutoffKrw / config.usdKrwRate) * 1_000_000)
