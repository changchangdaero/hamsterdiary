import assert from 'node:assert/strict'
import test from 'node:test'
import { periods, resetTimes } from '../src/usage-store.js'
import { parseUsageRequest } from '../src/validation.js'

test('days and months follow Korea time', () => {
  // 2026-10-31 15:30 UTC is already 2026-11-01 00:30 in Korea.
  assert.deepEqual(periods(new Date('2026-10-31T15:30:00Z')), { day: '2026-11-01', month: '2026-11' })
  assert.deepEqual(periods(new Date('2026-10-31T14:59:00Z')), { day: '2026-10-31', month: '2026-10' })
})

test('limits refill at the next Korea midnight and month start', () => {
  assert.deepEqual(resetTimes(new Date('2026-10-30T05:00:00Z')), {
    daily: '2026-10-30T15:00:00.000Z',
    monthly: '2026-10-31T15:00:00.000Z'
  })
})

test('usage request needs a UUID and a version', () => {
  assert.deepEqual(
    parseUsageRequest({ installationId: '550E8400-E29B-41D4-A716-446655440000', appVersion: '0.1.6' }),
    { installationId: '550e8400-e29b-41d4-a716-446655440000', appVersion: '0.1.6' }
  )
  assert.throws(() => parseUsageRequest({ installationId: 'nope', appVersion: '0.1.6' }))
  assert.throws(() => parseUsageRequest(undefined))
})
