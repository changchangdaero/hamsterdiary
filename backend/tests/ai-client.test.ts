import assert from 'node:assert/strict'
import test from 'node:test'
import { trimToLastSentence } from '../src/ai-client.js'

test('cut reply keeps only finished sentences', () => {
  assert.equal(trimToLastSentence('오늘도 힘내자! 내가 옆에서 같이'), '오늘도 힘내자!')
  assert.equal(trimToLastSentence('잠깐 쉬어도 돼. 물 한 잔 마시고~ 다시 시'), '잠깐 쉬어도 돼. 물 한 잔 마시고~')
})

test('reply without sentence end is kept whole', () => {
  assert.equal(trimToLastSentence('끝맺음 없는 짧은 답'), '끝맺음 없는 짧은 답')
})
