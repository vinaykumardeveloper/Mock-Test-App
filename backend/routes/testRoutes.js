const express = require('express')
const crypto = require('crypto')
const { isDbConnected } = require('../config/db')
const Test = require('../models/Test')
const Question = require('../models/Question')
const {
  getDisplayNumber,
  getRootNumbers,
  backfillTestNumbers,
  nextTestNumber,
} = require('../utils/testNumber')
const { normalizeQuestionOptions } = require('../utils/questionOptions')
const { listUsers } = require('../config/users')

const router = express.Router()
const OPTION_LABELS = ['A', 'B', 'C', 'D']

function createTestId() {
  return `TST-${crypto.randomUUID()}`
}

function getRootTestId(test) {
  const rootTestId = String(test?.rootTestId || '').trim()
  if (rootTestId) {
    return rootTestId
  }
  return String(test?.testId || '').trim()
}

function getAttemptNumber(test) {
  const attemptNumber = Number(test?.attemptNumber)
  if (Number.isInteger(attemptNumber) && attemptNumber > 0) {
    return attemptNumber
  }
  return 1
}

router.use((req, res, next) => {
  if (isDbConnected()) {
    next()
    return
  }

  res.status(503).json({
    success: false,
    message:
      'Database is not connected. Please check MongoDB Atlas whitelist and credentials.',
  })
})

router.get('/', async (req, res, next) => {
  try {
    await backfillTestNumbers(req.user.id)
    const rows = await Test.find(
      { owner: req.user.id },
      {
        _id: 0,
        testId: 1,
        nickname: 1,
        rootTestId: 1,
        sourceTestId: 1,
        testNumber: 1,
        attemptNumber: 1,
        testName: 1,
        totalQuestions: 1,
        durationMinutes: 1,
        markingScheme: 1,
        result: 1,
        filters: 1,
        createdAt: 1,
      },
    )
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()

    const rootNumbers = await getRootNumbers(req.user.id, rows)

    res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        displayNumber: getDisplayNumber(row, rootNumbers.get(row.rootTestId || row.testId)),
        rootTestId: row.rootTestId || row.testId,
        sourceTestId: row.sourceTestId || null,
        attemptNumber:
          Number.isInteger(row.attemptNumber) && row.attemptNumber > 0
            ? row.attemptNumber
            : 1,
      })),
    })
  } catch (error) {
    next(error)
  }
})

function normalizeTestRow(row, rootNumbers) {
  return {
    ...row,
    displayNumber: getDisplayNumber(row, rootNumbers.get(row.rootTestId || row.testId)),
    rootTestId: row.rootTestId || row.testId,
    sourceTestId: row.sourceTestId || null,
    attemptNumber:
      Number.isInteger(row.attemptNumber) && row.attemptNumber > 0 ? row.attemptNumber : 1,
  }
}

router.get('/all', async (req, res, next) => {
  try {
    await Promise.all(listUsers().map((user) => backfillTestNumbers(user.id)))
    const rows = await Test.find(
      {},
      {
        _id: 0,
        testId: 1,
        owner: 1,
        nickname: 1,
        rootTestId: 1,
        sourceTestId: 1,
        testNumber: 1,
        attemptNumber: 1,
        testName: 1,
        totalQuestions: 1,
        durationMinutes: 1,
        markingScheme: 1,
        result: 1,
        filters: 1,
        createdAt: 1,
      },
    )
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()

    const rootNumbers = await getRootNumbers('', rows)

    res.json({
      success: true,
      data: rows.map((row) => normalizeTestRow(row, rootNumbers)),
    })
  } catch (error) {
    next(error)
  }
})

function normalizeQuestionForRetake(questionDoc, index) {
  const questionText = String(questionDoc.question || '').trim()
  if (!questionText) {
    return null
  }

  const options = normalizeQuestionOptions(questionDoc.options)

  if (options.length < 4) {
    return null
  }

  const answerRaw = String(questionDoc.correctAnswer || '')
    .trim()
    .toUpperCase()
  let correctOption = -1
  if (OPTION_LABELS.includes(answerRaw)) {
    correctOption = OPTION_LABELS.indexOf(answerRaw)
  } else {
    const answerNumber = Number(answerRaw)
    if (Number.isInteger(answerNumber) && answerNumber >= 1 && answerNumber <= 4) {
      correctOption = answerNumber - 1
    }
  }

  if (correctOption < 0 || correctOption >= options.length) {
    return null
  }

  const rawQuestionNumber = Number(questionDoc.questionNumber)
  const questionNumber =
    Number.isInteger(rawQuestionNumber) && rawQuestionNumber > 0 ? rawQuestionNumber : null

  return {
    id: index + 1,
    questionId: String(questionDoc._id),
    questionNumber,
    chapter: String(questionDoc.chapter || '').trim(),
    topic: String(questionDoc.topic || '').trim(),
    difficulty: String(questionDoc.difficulty || '').trim(),
    question: questionText,
    options: options.slice(0, 4),
    correctOption,
  }
}

router.post('/:testId/retake', async (req, res, next) => {
  try {
    const testId = String(req.params.testId || '').trim()

    if (!testId) {
      res.status(400).json({
        success: false,
        message: 'testId is required.',
      })
      return
    }

    let sourceTest = await Test.findOne({ testId }).lean()
    if (!sourceTest) {
      res.status(404).json({
        success: false,
        message: `Test not found for testId "${testId}".`,
      })
      return
    }

    await Promise.all([
      backfillTestNumbers(req.user.id),
      sourceTest.owner ? backfillTestNumbers(sourceTest.owner) : Promise.resolve(),
    ])
    sourceTest = await Test.findOne({ testId }).lean()
    if (!sourceTest) {
      res.status(404).json({
        success: false,
        message: `Test not found for testId "${testId}".`,
      })
      return
    }

    const orderedRefs = Array.isArray(sourceTest.questions)
      ? [...sourceTest.questions].sort((a, b) => Number(a.order) - Number(b.order))
      : []
    if (orderedRefs.length === 0) {
      res.status(422).json({
        success: false,
        message: `Test "${testId}" has no question references.`,
      })
      return
    }

    const questionIds = orderedRefs.map((item) => String(item.questionId))
    const docs = await Question.find({ _id: { $in: questionIds } }).lean()
    const docMap = new Map(docs.map((doc) => [String(doc._id), doc]))

    const missingQuestionIds = questionIds.filter((questionId) => !docMap.has(questionId))
    if (missingQuestionIds.length > 0) {
      res.status(422).json({
        success: false,
        message: `Some test questions are missing from question bank: ${missingQuestionIds.join(', ')}`,
      })
      return
    }

    const normalized = []
    for (let index = 0; index < orderedRefs.length; index += 1) {
      const ref = orderedRefs[index]
      const doc = docMap.get(String(ref.questionId))
      const question = normalizeQuestionForRetake(doc, index)
      if (!question) {
        res.status(422).json({
          success: false,
          message: `Invalid question data for questionId "${String(ref.questionId)}".`,
        })
        return
      }
      normalized.push(question)
    }

    const rootTestId = getRootTestId(sourceTest)
    const attempts = await Test.find(
      {
        owner: req.user.id,
        $or: [{ rootTestId }, { testId: rootTestId }],
      },
      {
        attemptNumber: 1,
        testNumber: 1,
      },
    ).lean()
    const maxAttemptNumber = attempts.reduce((maxValue, item) => {
      const attempt = getAttemptNumber(item)
      return attempt > maxValue ? attempt : maxValue
    }, 0)
    const nextAttemptNumber = maxAttemptNumber + 1

    const newTestId = createTestId()
    const questionReferences = orderedRefs.map((item, index) => ({
      questionId: item.questionId,
      order: index + 1,
    }))

    const firstAttempt = attempts.find((item) => getAttemptNumber(item) === 1)
    const retakeNumber =
      firstAttempt?.testNumber ||
      (sourceTest.owner === req.user.id
        ? sourceTest.testNumber
        : await nextTestNumber(req.user.id))

    await Test.create({
      testId: newTestId,
      owner: req.user.id,
      testNumber: retakeNumber,
      rootTestId,
      sourceTestId: sourceTest.testId,
      attemptNumber: nextAttemptNumber,
      testName: sourceTest.testName,
      nickname: sourceTest.nickname || '',
      totalQuestions: sourceTest.totalQuestions,
      durationMinutes: sourceTest.durationMinutes,
      markingScheme: sourceTest.markingScheme,
      filters: sourceTest.filters,
      questions: questionReferences,
    })

    res.json({
      success: true,
      data: {
        testId: newTestId,
        testNumber: retakeNumber,
        displayNumber: getDisplayNumber(
          { testNumber: retakeNumber, attemptNumber: nextAttemptNumber },
          retakeNumber,
        ),
        rootTestId,
        sourceTestId: sourceTest.testId,
        attemptNumber: nextAttemptNumber,
        testName: sourceTest.testName,
        nickname: sourceTest.nickname || '',
        markingScheme: sourceTest.markingScheme,
        durationMinutes: sourceTest.durationMinutes,
        totalQuestions: sourceTest.totalQuestions,
        questions: normalized,
      },
    })
  } catch (error) {
    next(error)
  }
})

router.post('/:testId/result', async (req, res, next) => {
  try {
    const testId = String(req.params.testId || '').trim()
    if (!testId) {
      res.status(400).json({ success: false, message: 'testId is required.' })
      return
    }

    const body = req.body || {}
    const test = await Test.findOne(
      { testId, owner: req.user.id },
      { totalQuestions: 1, markingScheme: 1 },
    ).lean()
    if (!test) {
      res.status(404).json({ success: false, message: 'Test not found.' })
      return
    }

    const totalQuestions = Number(test.totalQuestions)
    if (!Number.isInteger(totalQuestions) || totalQuestions <= 0) {
      throw new Error(`Invalid totalQuestions for test "${testId}".`)
    }

    const toCount = (value) => {
      const number = Number(value)
      return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : 0
    }
    const toMarks = (value) => {
      const number = Number(value)
      return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0
    }
    const correctMarks = Number(test?.markingScheme?.correct)
    const incorrectMarks = Number(test?.markingScheme?.incorrect)
    const resolvedCorrectMarks = Number.isFinite(correctMarks) ? correctMarks : 1
    const resolvedIncorrectMarks = Number.isFinite(incorrectMarks) ? incorrectMarks : 0

    let correct = toCount(body.correct)
    let incorrect = toCount(body.incorrect)
    correct = Math.min(correct, totalQuestions)
    incorrect = Math.min(incorrect, totalQuestions - correct)
    const notAnswered = totalQuestions - correct - incorrect

    const result = {
      correct,
      incorrect,
      notAnswered,
      score: toMarks(correct * resolvedCorrectMarks + incorrect * resolvedIncorrectMarks),
      maxScore: toMarks(totalQuestions * resolvedCorrectMarks),
      submittedAt: new Date(),
    }

    const updated = await Test.findOneAndUpdate(
      { testId, owner: req.user.id },
      { $set: { result } },
      { new: true, projection: { result: 1 } },
    ).lean()
    if (!updated) {
      res.status(404).json({ success: false, message: 'Test not found.' })
      return
    }

    res.json({ success: true, data: updated.result })
  } catch (error) {
    next(error)
  }
})

router.get('/:testId', async (req, res, next) => {
  try {
    const testId = String(req.params.testId || '').trim()

    if (!testId) {
      res.status(400).json({
        success: false,
        message: 'testId is required.',
      })
      return
    }

    const includeAllOwners = req.query.scope === 'all'
    await backfillTestNumbers(req.user.id)
    const test = await Test.findOne(
      includeAllOwners ? { testId } : { testId, owner: req.user.id },
    ).lean()

    if (!test) {
      res.status(404).json({
        success: false,
        message: `Test not found for testId "${testId}".`,
      })
      return
    }

    const rootNumbers = await getRootNumbers(includeAllOwners ? '' : req.user.id, [test])

    res.json({
      success: true,
      data: {
        ...test,
        displayNumber: getDisplayNumber(
          { ...test, attemptNumber: getAttemptNumber(test) },
          rootNumbers.get(getRootTestId(test)),
        ),
        rootTestId: test.rootTestId || test.testId,
        sourceTestId: test.sourceTestId || null,
        attemptNumber: getAttemptNumber(test),
      },
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
