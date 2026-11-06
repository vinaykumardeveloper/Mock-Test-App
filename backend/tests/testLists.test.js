const assert = require('node:assert/strict')
const { after, test } = require('node:test')
const Test = require('../models/Test')
const TestAttempt = require('../models/TestAttempt')
const numbers = require('../utils/testNumber')

const original = {
  testFind: Test.find,
  testFindOne: Test.findOne,
  attemptFind: TestAttempt.find,
  rootNumbers: numbers.getRootNumbers,
  backfill: numbers.backfillTestNumbers,
}
numbers.getRootNumbers = async () => new Map([['root', 4]])
numbers.backfillTestNumbers = async () => {}
const router = require('../routes/testRoutes')
after(() => {
  Test.find = original.testFind
  Test.findOne = original.testFindOne
  TestAttempt.find = original.attemptFind
  numbers.getRootNumbers = original.rootNumbers
  numbers.backfillTestNumbers = original.backfill
})

const root = {
  testId: 'root', rootTestId: 'root', owner: 'H', testNumber: 4, attemptNumber: 1,
  testName: 'Test', createdAt: '2026-01-01',
}
const legacy = {
  ...root, testId: 'legacy', attemptNumber: 2, createdAt: '2026-02-01',
  result: { score: 2, maxScore: 5, submittedAt: '2026-02-01' },
}
const attempts = [
  { attemptId: 'attempt-3', testId: 'root', rootTestId: 'root', attemptNumber: 3, createdAt: '2026-03-01', result: null, completionStatus: 'in_progress' },
  { attemptId: 'attempt-1', testId: 'root', rootTestId: 'root', attemptNumber: 1, createdAt: '2026-01-01', result: { score: 1, maxScore: 5, submittedAt: '2026-01-01' } },
]
function query(value) {
  return { sort: () => query(value), limit: () => query(value), lean: async () => value }
}
function response() {
  return { json(body) { this.body = body; return this }, status(code) { this.statusCode = code; return this } }
}
async function call(path, req) {
  const handler = router.stack.find((layer) => layer.route?.path === path).route.stack[0].handle
  const res = response()
  await handler(req, res, (error) => { throw error })
  return res.body.data
}
function prepare() {
  TestAttempt.find = (filter) => {
    assert.equal(filter.userId, 'H')
    return query(attempts)
  }
  Test.find = (filter) => {
    if (filter.owner) {
      assert.equal(filter.owner, 'H')
      return query([legacy])
    }
    return query([root])
  }
  Test.findOne = () => query(root)
}

test('previous tests consolidate attempts before limiting and keep the latest completed result', async () => {
  prepare()
  const data = await call('/', { user: { id: 'H' } })
  assert.equal(data.length, 1)
  assert.equal(data[0].testId, 'attempt-3')
  assert.equal(data[0].userAttemptNumber, 3)
  assert.equal(data[0].resultAttemptNumber, 2)
  assert.equal(data[0].result.score, 2)
})

test('all tests and their detail show the same latest user result and attempt number', async () => {
  prepare()
  const list = await call('/all', { user: { id: 'H' } })
  assert.equal(list.length, 1)
  assert.equal(list[0].userAttemptNumber, 3)
  assert.equal(list[0].resultAttemptNumber, 2)
  assert.equal(list[0].result.score, 2)
  const detail = await call('/:testId', { params: { testId: 'root' }, query: { scope: 'all' }, user: { id: 'H' } })
  assert.equal(detail.userAttemptNumber, 3)
  assert.equal(detail.resultAttemptNumber, 2)
  assert.equal(detail.result.score, 2)
})

test('all tests selects the original when multiple library rows share a root', async () => {
  prepare()
  let selectedIds
  Test.find = (filter) => {
    if (filter.owner) return query([legacy])
    if (filter.attemptNumber === 1) {
      return query([{ ...root, testId: 'duplicate', createdAt: '2026-03-01' }, root])
    }
    selectedIds = filter.testId.$in
    return query([root])
  }
  const list = await call('/all', { user: { id: 'H' } })
  assert.deepEqual(selectedIds, ['root'])
  assert.equal(list.length, 1)
  assert.equal(list[0].testId, 'root')
})
