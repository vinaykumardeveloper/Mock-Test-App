const assert = require('node:assert/strict')
const { after, test } = require('node:test')
const Test = require('../models/Test')
const TestAttempt = require('../models/TestAttempt')
const Question = require('../models/Question')
const router = require('../routes/testRoutes')

const original = {
  test: Test.findOne,
  findTests: Test.find,
  attempt: TestAttempt.findOne,
  attempts: TestAttempt.find,
  createAttempt: TestAttempt.create,
  questions: Question.find,
}
after(() => {
  Test.findOne = original.test
  Test.find = original.findTests
  TestAttempt.findOne = original.attempt
  TestAttempt.find = original.attempts
  TestAttempt.create = original.createAttempt
  Question.find = original.questions
})

const handler = router.stack.find((layer) => layer.route?.path === '/:testId/review')
  .route.stack[0].handle
const libraryTest = {
  testId: 'test-1',
  testNumber: 7,
  questions: [{ questionId: 'abc', order: 1 }, { questionId: 'def', order: 2 }],
}
const result = { correct: 0, incorrect: 1, notAnswered: 1, score: 0, maxScore: 2 }
const markingScheme = { correct: 1, incorrect: 0 }

function query(value) {
  return { sort: () => query(value), lean: async () => value }
}

async function request(attempt, docs = [], legacy = []) {
  let filter
  Test.findOne = () => query(libraryTest)
  Test.find = () => query(legacy)
  TestAttempt.findOne = (value) => {
    filter = value
    return query(attempt)
  }
  Question.find = () => query(docs)
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
  await handler({ params: { testId: 'test-1' }, user: { id: 'H' } }, response, (error) => { throw error })
  return { response, filter }
}

test('returns only the current user’s completed attempt and its original snapshot', async () => {
  const questions = [
    { id: 'abc', question: 'Original?', options: ['A', 'B'], correctOption: 1 },
    { id: 'def', question: 'Second?', options: ['C', 'D'], correctOption: 0 },
  ]
  const { response, filter } = await request({
    attemptId: 'attempt-2', rootTestId: 'test-1',
    questions, answers: { abc: 0 }, totalQuestions: 2, result, markingScheme, attemptNumber: 2,
  })
  assert.deepEqual(filter, {
    rootTestId: 'test-1', userId: 'H', completionStatus: 'completed', result: { $ne: null },
  })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body.data.questions, questions)
  assert.deepEqual(response.body.data.answers, { abc: 0 })
  assert.equal(response.body.data.displayNumber, '7-2')
  assert.equal(response.body.data.reconstructed, false)
})

test('attempt schema retains question snapshots and casts numeric question IDs', async () => {
  const attempt = new TestAttempt({
    attemptId: 'attempt-1',
    userId: 'H',
    testId: 'test-1',
    rootTestId: 'test-1',
    testName: 'Test',
    totalQuestions: 1,
    durationMinutes: 5,
    markingScheme,
    questions: [{ id: 1, question: 'Original?', options: ['A', 'B'], correctOption: 1 }],
  })
  await attempt.validate()
  assert.deepEqual(attempt.toObject().questions, [
    { id: '1', question: 'Original?', options: ['A', 'B'], correctOption: 1 },
  ])
})

test('maps both historical question IDs and retake indexes to review answers', async () => {
  const docs = [
    { _id: 'abc', question: 'First?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B' },
    { _id: 'def', question: 'Second?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
  ]
  for (const answers of [{ abc: 0 }, { 1: 0 }]) {
    const { response } = await request({
      attemptId: 'attempt-1', rootTestId: 'test-1', answers, totalQuestions: 2, result, markingScheme,
    }, docs)
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.body.data.answers, { 1: 0 })
    assert.equal(response.body.data.questions[0].question, 'First?')
    assert.equal(response.body.data.reconstructed, true)
  }
})

test('retaking a test saves the same questions returned to the user', async () => {
  const retake = router.stack.find((layer) => layer.route?.path === '/:testId/retake')
    .route.stack[0].handle
  const docs = [
    { _id: 'abc', question: 'First?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B' },
    { _id: 'def', question: 'Second?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
  ]
  let created
  Test.findOne = () => query({ ...libraryTest, totalQuestions: 2, markingScheme })
  TestAttempt.find = () => query([])
  Test.find = () => query([{ attemptNumber: 2 }])
  TestAttempt.create = async (value) => { created = value }
  Question.find = () => query(docs)
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
  await retake({ params: { testId: 'test-1' }, user: { id: 'H' } }, response, (error) => { throw error })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(created.questions, response.body.data.questions)
  assert.equal(created.userId, 'H')
  assert.equal(created.attemptNumber, 3)
})

test('does not review an older saved attempt when the latest result is legacy', async () => {
  const { response } = await request({
    attemptId: 'attempt-1', rootTestId: 'test-1', attemptNumber: 1,
    result: { ...result, submittedAt: '2026-01-01' }, markingScheme,
  }, [], [{
    testId: 'legacy', rootTestId: 'test-1', attemptNumber: 2,
    result: { ...result, submittedAt: '2026-02-01' },
  }])
  assert.equal(response.statusCode, 422)
  assert.match(response.body.message, /latest completed attempt.*older result/)
})
test('reports absent or incomplete saved attempts rather than inventing answers', async () => {
  const absent = await request(null)
  assert.equal(absent.response.statusCode, 404)
  const incomplete = await request({
    attemptId: 'attempt-1', rootTestId: 'test-1',
    questions: [{ id: 'abc', question: 'Question?', options: ['A'], correctOption: 0 }],
    answers: {}, totalQuestions: 1, result, markingScheme,
  })
  assert.equal(incomplete.response.statusCode, 422)
  assert.match(incomplete.response.body.message, /incomplete/)
})
