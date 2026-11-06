import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { ESLint } from 'eslint'
import { copyQuestions, formatQuestionsForCopy } from '../src/features/mock-test/utils/copyQuestions.js'

const server = await createServer({
  configFile: false,
  plugins: [react()],
  server: { middlewareMode: true },
  appType: 'custom',
})
after(() => server.close())

const { ResultScreen } = await server.ssrLoadModule(
  '/src/features/mock-test/components/ResultScreen.jsx',
)
const { PreviousTestsScreen } = await server.ssrLoadModule(
  '/src/features/mock-test/components/PreviousTestsScreen.jsx',
)

test('application screen handlers are defined in scope', async () => {
  const eslint = new ESLint()
  const results = await eslint.lintFiles('src/features/mock-test/MockTestApp.jsx')
  const undefinedNames = results.flatMap((result) =>
    result.messages.filter((message) => message.ruleId === 'no-undef'),
  )
  assert.deepEqual(undefinedNames, [])
})

test('shows Review Test after Take Test only when review is available', () => {
  const selectedTest = {
    testId: 'test-1', testName: 'Test', totalQuestions: 2, durationMinutes: 5,
    userAttemptNumber: 3, resultAttemptNumber: 2, result: { score: 1, maxScore: 2 },
  }
  const props = {
    previousTests: [selectedTest],
    selectedTestId: 'test-1',
    selectedTest,
    testActionLabel: 'Take Test',
    onReviewTest: () => {},
  }
  const html = renderToStaticMarkup(React.createElement(PreviousTestsScreen, props))
  assert.ok(html.indexOf('Take Test') < html.indexOf('Review Test'))
  assert.match(html, /Attempt number - 3/)
  assert.match(html, /Result - Attempt 2/)
  const otherScreen = renderToStaticMarkup(React.createElement(PreviousTestsScreen, {
    ...props, onReviewTest: undefined,
  }))
  assert.doesNotMatch(otherScreen, /Review Test/)
})

test('reviews correct, incorrect and unanswered questions with every option', () => {
  const questions = [
    { id: '1', question: 'Correctly answered', options: ['First', 'Second'], correctOption: 0 },
    { id: '2', question: 'Wrongly answered', options: ['Third', 'Fourth'], correctOption: 1 },
    { id: '3', question: 'Unanswered', options: ['Fifth', 'Sixth'], correctOption: 0 },
  ]
  const html = renderToStaticMarkup(React.createElement(ResultScreen, {
    result: { score: 1, maxScore: 3, correct: 1, incorrect: 1, notAnswered: 1 },
    questions,
    answers: { 1: 0, 2: 0 },
    onBackToHome: () => {},
  }))
  const articles = [...html.matchAll(/<article class="review-question">([\s\S]*?)<\/article>/g)]

  assert.equal(articles.length, 3)
  assert.match(articles[0][1], /Correctly answered/)
  assert.match(articles[0][1], /review-option correct"><span>A\. First<\/span>.*Correct answer · Your answer/)
  assert.match(articles[0][1], /B\. Second/)
  assert.match(articles[1][1], /review-option incorrect"><span>A\. Third<\/span>.*Your answer/)
  assert.match(articles[1][1], /review-option correct"><span>B\. Fourth<\/span>.*Correct answer/)
  assert.match(articles[2][1], /Not attempted/)
  assert.match(articles[2][1], /review-option correct"><span>A\. Fifth<\/span>.*Correct answer/)
  assert.match(articles[2][1], /B\. Sixth/)
  assert.doesNotMatch(articles[2][1], /Your answer|review-option incorrect/)
  assert.match(html, /Copy Questions and Answers/)
  assert.ok(html.indexOf('Copy Questions and Answers') > html.lastIndexOf('</article>'))
})

test('copies all questions, options and correct answers without selected answers', async () => {
  const questions = [
    { id: '1', question: 'First question?', options: ['One', 'Two'], correctOption: 1 },
    { id: '2', question: 'Second question?', options: ['Three', 'Four'], correctOption: 0 },
  ]
  const expected = [
    'Question 1: First question?',
    'A. One',
    'B. Two',
    'Correct answer: B. Two',
    '',
    'Question 2: Second question?',
    'A. Three',
    'B. Four',
    'Correct answer: A. Three',
  ].join('\n')
  let copied
  await copyQuestions(questions, { writeText: async (text) => { copied = text } })
  assert.equal(copied, expected)
  assert.equal(formatQuestionsForCopy(questions), expected)
})

test('reports unavailable clipboard, denied writes and invalid answer indexes', async () => {
  const questions = [{ id: '1', question: 'Question?', options: ['One'], correctOption: 0 }]
  await assert.rejects(copyQuestions(questions, undefined), /Clipboard access is unavailable/)
  await assert.rejects(
    copyQuestions(questions, { writeText: async () => { throw new Error('Permission denied') } }),
    /Permission denied/,
  )
  const invalidQuestions = [{ ...questions[0], correctOption: 1 }]
  await assert.rejects(copyQuestions(invalidQuestions, { writeText: async () => {} }), /invalid answer/)
})
