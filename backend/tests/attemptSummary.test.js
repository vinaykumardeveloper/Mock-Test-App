const assert = require('node:assert/strict')
const { test } = require('node:test')
const { summarizeAttempts } = require('../utils/attemptSummary')

test('groups legacy and modern attempts by root and labels the latest completed result', () => {
  const rows = [
    { testId: 'original', rootTestId: 'original', attemptNumber: 1, createdAt: '2026-01-01', result: { score: 1, submittedAt: '2026-01-01' } },
    { testId: 'old-retake', rootTestId: 'original', attemptNumber: 2, createdAt: '2026-02-01', result: { score: 2, submittedAt: '2026-02-01' } },
    { testId: 'attempt-3', rootTestId: 'original', attemptNumber: 3, createdAt: '2026-03-01', result: null },
    { testId: 'another', rootTestId: 'another', attemptNumber: 1, createdAt: '2026-04-01', result: { score: 4 } },
  ]
  const grouped = summarizeAttempts(rows)
  assert.equal(grouped.length, 2)
  const first = grouped.find((item) => item.rootTestId === 'original')
  assert.equal(first.testId, 'attempt-3')
  assert.equal(first.userAttemptNumber, 3)
  assert.equal(first.result.score, 2)
  assert.equal(first.resultAttemptNumber, 2)
  assert.equal(first.resultTestId, 'old-retake')
})

test('uses latest submission rather than latest start for results', () => {
  const [item] = summarizeAttempts([
    { testId: 'a', rootTestId: 'test', attemptNumber: 1, createdAt: '2026-01-01', result: { score: 7, submittedAt: '2026-03-01' } },
    { testId: 'b', rootTestId: 'test', attemptNumber: 2, createdAt: '2026-02-01', result: { score: 2, submittedAt: '2026-02-01' } },
  ])
  assert.equal(item.userAttemptNumber, 2)
  assert.equal(item.resultAttemptNumber, 1)
  assert.equal(item.result.score, 7)
})

test('keeps unanswered tests separate without fabricating a result', () => {
  const result = summarizeAttempts([
    { testId: 'a', attemptNumber: 1, createdAt: '2026-01-01' },
    { testId: 'b', attemptNumber: 1, createdAt: '2026-01-01' },
  ])
  assert.equal(result.length, 2)
  assert.equal(result[0].result, null)
  assert.equal(result[0].resultAttemptNumber, null)
})
