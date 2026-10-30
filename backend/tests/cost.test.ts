import assert from 'node:assert/strict'
import test from 'node:test'
import { estimateCostMicroUsd } from '../src/cost.js'
import type { AppConfig } from '../src/config.js'

test('estimates model cost in micro USD', () => {
  const config = {
    inputUsdPerMillionTokens: 0.05,
    outputUsdPerMillionTokens: 0.4
  } as AppConfig
  assert.equal(estimateCostMicroUsd({ inputTokens: 5_000, outputTokens: 300 }, config), 370)
})
