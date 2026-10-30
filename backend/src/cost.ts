import type { AppConfig } from './config.js'
import type { AiUsage } from './types.js'

export const estimateCostMicroUsd = (usage: AiUsage, config: AppConfig): number =>
  Math.ceil(
    usage.inputTokens * config.inputUsdPerMillionTokens +
      usage.outputTokens * config.outputUsdPerMillionTokens
  )
