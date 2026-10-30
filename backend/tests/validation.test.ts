import assert from 'node:assert/strict'
import test from 'node:test'
import { parseChatRequest } from '../src/validation.js'

test('valid chat request is normalized', () => {
  const result = parseChatRequest(
    {
      installationId: '550E8400-E29B-41D4-A716-446655440000',
      appVersion: '0.1.6',
      message: ' 안녕 ',
      history: [{ role: 'assistant', content: ' 반가워 ' }]
    },
    1_000,
    5
  )
  assert.equal(result.installationId, '550e8400-e29b-41d4-a716-446655440000')
  assert.equal(result.message, '안녕')
  assert.equal(result.history[0]?.content, '반가워')
})

test('rejects too much history', () => {
  assert.throws(() =>
    parseChatRequest(
      {
        installationId: '550e8400-e29b-41d4-a716-446655440000',
        appVersion: '0.1.6',
        message: '안녕',
        history: Array.from({ length: 6 }, () => ({ role: 'user', content: '말' }))
      },
      1_000,
      5
    )
  )
})
