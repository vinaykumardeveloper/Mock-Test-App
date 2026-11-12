const assert = require('node:assert/strict')
const { after, test } = require('node:test')
const Question = require('../models/Question')
const Test = require('../models/Test')
const TestAttempt = require('../models/TestAttempt')
const numbers = require('../utils/testNumber')

const original = {
  count: Question.countDocuments,
  find: Question.find,
  createTest: Test.create,
  createAttempt: TestAttempt.create,
  nextTestNumber: numbers.nextTestNumber,
}
numbers.nextTestNumber = async () => 1
const router = require('../routes/questionRoutes')
after(() => {
  Question.countDocuments = original.count
  Question.find = original.find
  Test.create = original.createTest
  TestAttempt.create = original.createAttempt
  numbers.nextTestNumber = original.nextTestNumber
})

const handler = router.stack.find((layer) => layer.route?.path === '/create-test').route.stack[0].handle
const difficulties = ['Easy', 'Moderate', 'Hard']

async function createTest(selections) {
  const docs = selections.map((item, index) => ({
    _id: String(index + 1),
    subject: item.subject,
    chapter: item.chapter,
    topic: item.topics[0] || '',
    difficulty: 'Easy',
    question: `Question ${index + 1}`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
  }))
  Question.countDocuments = async () => docs.length
  Question.find = () => ({ lean: async () => docs })
  let savedTest
  let savedAttempt
  Test.create = async (value) => { savedTest = value }
  TestAttempt.create = async (value) => { savedAttempt = value }
  const response = {
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
  await handler(
    { user: { id: 'H' }, body: { selections, totalQuestions: selections.length } },
    response,
    (error) => { throw error },
  )
  assert.equal(response.body.success, true)
  assert.equal(savedTest.testName, response.body.data.testName)
  assert.equal(savedAttempt.testName, response.body.data.testName)
  return response.body.data.testName
}

test('uses the chapter and selected General Awareness topics in the saved test title', async () => {
  const title = await createTest([
    { subject: 'General Awareness', chapter: 'History', topics: ['Ancient', 'Medieval'], difficulties },
  ])
  assert.equal(title, 'Mock Test • General Awareness • History (Ancient, Medieval)')
})

test('uses topics only for General Awareness in a mixed-subject test', async () => {
  const title = await createTest([
    { subject: 'Maths', chapter: 'Numbers', topics: ['Arithmetic'], difficulties },
    { subject: 'General Awarness', chapter: 'History', topics: ['Ancient'], difficulties },
  ])
  assert.equal(title, 'Mock Test • Maths, General Awarness • Numbers, History (Ancient)')
})

test('keeps the General Awareness chapter when no topic filter is available', async () => {
  const title = await createTest([
    { subject: 'General Awareness', chapter: 'History', topics: [], difficulties },
  ])
  assert.equal(title, 'Mock Test • General Awareness • History')
})
