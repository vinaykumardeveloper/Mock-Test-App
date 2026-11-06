const express = require('express')
const crypto = require('crypto')
const { isDbConnected } = require('../config/db')
const Test = require('../models/Test')
const TestAttempt = require('../models/TestAttempt')
const Question = require('../models/Question')
const {
  getDisplayNumber,
  getRootNumbers,
  backfillTestNumbers,
} = require('../utils/testNumber')
const { normalizeQuestionOptions } = require('../utils/questionOptions')
const { summarizeAttempts } = require('../utils/attemptSummary')

const router = express.Router()
const OPTION_LABELS = ['A', 'B', 'C', 'D']

function createAttemptId() {
  return `ATT-${crypto.randomUUID()}`
}

function getRootTestId(test) {
  const rootTestId = String(test?.rootTestId || '').trim()
  if (rootTestId) {
    return rootTestId
  }
  return String(test?.testId || '').trim()
}

function getAttemptNumber(value) {
  const number = Number(value?.attemptNumber)
  if (Number.isInteger(number) && number > 0) {
    return number
  }
  return 1
}

function toDisplayNumber(testNumber, attemptNumber) {
  const parsedTestNumber = Number(testNumber)
  const parsedAttemptNumber = Number(attemptNumber)
  if (!Number.isInteger(parsedTestNumber) || parsedTestNumber <= 0) {
    return null
  }
  if (Number.isInteger(parsedAttemptNumber) && parsedAttemptNumber > 1) {
    return `${parsedTestNumber}-${parsedAttemptNumber}`
  }
  return String(parsedTestNumber)
}

function normalizeLibraryRow(row, rootNumbers) {
  return {
    ...row,
    displayNumber: getDisplayNumber(row, rootNumbers.get(row.rootTestId || row.testId)),
    rootTestId: row.rootTestId || row.testId,
    sourceTestId: row.sourceTestId || null,
    attemptNumber:
      Number.isInteger(row.attemptNumber) && row.attemptNumber > 0 ? row.attemptNumber : 1,
  }
}

async function loadUserSummaries(rootIds, userId) {
  const userAttempts = await TestAttempt.find(
    { userId, rootTestId: { $in: rootIds } },
    { _id: 0, attemptId: 1, testId: 1, rootTestId: 1, attemptNumber: 1, result: 1, createdAt: 1, completionStatus: 1 },
  ).lean()
  const legacyAttempts = await Test.find(
    {
      owner: userId,
      rootTestId: { $in: rootIds },
      $or: [{ result: { $ne: null } }, { attemptNumber: { $gt: 1 } }],
    },
    { _id: 0, testId: 1, rootTestId: 1, attemptNumber: 1, result: 1, createdAt: 1 },
  ).lean()
  return new Map(
    summarizeAttempts([...userAttempts, ...legacyAttempts]).map((item) => [item.rootTestId, item]),
  )
}

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

async function loadTestQuestions(test) {
  const orderedRefs = Array.isArray(test.questions)
    ? [...test.questions].sort((a, b) => Number(a.order) - Number(b.order))
    : []
  if (orderedRefs.length === 0) {
    return { error: `Test "${test.testId}" has no question references.` }
  }

  const questionIds = orderedRefs.map((item) => String(item.questionId))
  const docs = await Question.find({ _id: { $in: questionIds } }).lean()
  const docMap = new Map(docs.map((doc) => [String(doc._id), doc]))
  const missingQuestionIds = questionIds.filter((questionId) => !docMap.has(questionId))
  if (missingQuestionIds.length > 0) {
    return { error: `Some test questions are missing from question bank: ${missingQuestionIds.join(', ')}` }
  }

  const questions = []
  for (let index = 0; index < orderedRefs.length; index += 1) {
    const ref = orderedRefs[index]
    const question = normalizeQuestionForRetake(docMap.get(String(ref.questionId)), index)
    if (!question) {
      return { error: `Invalid question data for questionId "${String(ref.questionId)}".` }
    }
    questions.push(question)
  }
  return { questions }
}

function buildAttemptResult(payload, testContext) {
  const toCount = (value) => {
    const number = Number(value)
    return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : 0
  }
  const toMarks = (value) => {
    const number = Number(value)
    return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0
  }

  const totalQuestions = Number(testContext.totalQuestions)
  const correctMarks = Number(testContext?.markingScheme?.correct)
  const incorrectMarks = Number(testContext?.markingScheme?.incorrect)
  const resolvedCorrectMarks = Number.isFinite(correctMarks) ? correctMarks : 1
  const resolvedIncorrectMarks = Number.isFinite(incorrectMarks) ? incorrectMarks : 0

  let correct = toCount(payload.correct)
  let incorrect = toCount(payload.incorrect)
  correct = Math.min(correct, totalQuestions)
  incorrect = Math.min(incorrect, totalQuestions - correct)
  const notAnswered = totalQuestions - correct - incorrect

  return {
    correct,
    incorrect,
    notAnswered,
    score: toMarks(correct * resolvedCorrectMarks + incorrect * resolvedIncorrectMarks),
    maxScore: toMarks(totalQuestions * resolvedCorrectMarks),
    submittedAt: new Date(),
  }
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
    const attempts = await TestAttempt.find(
      { userId: req.user.id },
      {
        _id: 0,
        attemptId: 1,
        testId: 1,
        rootTestId: 1,
        attemptNumber: 1,
        testName: 1,
        nickname: 1,
        totalQuestions: 1,
        durationMinutes: 1,
        markingScheme: 1,
        filters: 1,
        result: 1,
        completionStatus: 1,
        startedAt: 1,
        createdAt: 1,
      },
    )
      .sort({ createdAt: -1 })
      .lean()

    const testIds = [...new Set(attempts.map((item) => item.testId).filter(Boolean))]
    const testRows = await Test.find(
      { testId: { $in: testIds } },
      { _id: 0, testId: 1, owner: 1, testNumber: 1, rootTestId: 1, sourceTestId: 1, createdAt: 1 },
    ).lean()
    const testsById = new Map(testRows.map((item) => [item.testId, item]))

    const mappedAttempts = attempts.map((attempt) => {
      const test = testsById.get(attempt.testId)
      const testNumber = Number(test?.testNumber)
      return {
        testId: attempt.attemptId,
        libraryTestId: attempt.testId,
        owner: test?.owner || '',
        testName: attempt.testName,
        nickname: attempt.nickname || '',
        totalQuestions: attempt.totalQuestions,
        durationMinutes: attempt.durationMinutes,
        markingScheme: attempt.markingScheme,
        filters: attempt.filters || {},
        result: attempt.result || null,
        completionStatus: attempt.completionStatus || 'in_progress',
        rootTestId: attempt.rootTestId || attempt.testId,
        sourceTestId: test?.sourceTestId || null,
        attemptNumber: getAttemptNumber(attempt),
        displayNumber: toDisplayNumber(testNumber, getAttemptNumber(attempt)),
        createdAt: attempt.createdAt || attempt.startedAt || test?.createdAt,
      }
    })

    const legacyRows = await Test.find(
      {
        owner: req.user.id,
        $or: [{ result: { $ne: null } }, { attemptNumber: { $gt: 1 } }],
      },
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
      .lean()
    const legacyRootNumbers = await getRootNumbers(req.user.id, legacyRows)
    const mappedLegacyRows = legacyRows.map((row) =>
      normalizeLibraryRow({ ...row, completionStatus: row.result ? 'completed' : 'in_progress' }, legacyRootNumbers),
    )

    res.json({
      success: true,
      data: summarizeAttempts([...mappedAttempts, ...mappedLegacyRows]).sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ).slice(0, 200),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/all', async (req, res, next) => {
  try {
    const rows = await Test.find(
      { attemptNumber: 1 },
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
        filters: 1,
        createdAt: 1,
      },
    )
      .sort({ createdAt: -1 })
      .lean()

    const libraryByRoot = new Map()
    for (const row of rows) {
      const rootId = row.rootTestId || row.testId
      const existing = libraryByRoot.get(rootId)
      if (!existing || row.testId === rootId) libraryByRoot.set(rootId, row)
    }
    const libraryRows = [...libraryByRoot.values()]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 200)
    const creatorIds = [...new Set(libraryRows.map((item) => item.owner).filter(Boolean))]
    await Promise.all(creatorIds.map((owner) => backfillTestNumbers(owner)))

    const refreshedRows = await Test.find(
      { testId: { $in: libraryRows.map((item) => item.testId) } },
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
        filters: 1,
        createdAt: 1,
      },
    ).lean()

    const rootNumbers = await getRootNumbers('', refreshedRows)

    const summaries = await loadUserSummaries(
      refreshedRows.map((item) => item.rootTestId || item.testId),
      req.user.id,
    )

    res.json({
      success: true,
      data: refreshedRows
        .map((row) => {
          const summary = summaries.get(row.rootTestId || row.testId)
          return {
            ...normalizeLibraryRow(row, rootNumbers),
            result: summary?.result || null,
            resultAttemptNumber: summary?.resultAttemptNumber || null,
            completionStatus: summary?.completionStatus || (summary?.result ? 'completed' : 'in_progress'),
            userAttemptNumber: summary?.userAttemptNumber || 0,
          }
        })
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    })
  } catch (error) {
    next(error)
  }
})

router.post('/:testId/retake', async (req, res, next) => {
  try {
    const requestedId = String(req.params.testId || '').trim()
    if (!requestedId) {
      res.status(400).json({
        success: false,
        message: 'testId is required.',
      })
      return
    }

    let sourceTest = await Test.findOne({ testId: requestedId }).lean()
    if (!sourceTest) {
      const sourceAttempt = await TestAttempt.findOne({
        attemptId: requestedId,
        userId: req.user.id,
      }).lean()
      if (sourceAttempt) {
        sourceTest = await Test.findOne({ testId: sourceAttempt.testId }).lean()
      }
    }
    if (!sourceTest) {
      res.status(404).json({
        success: false,
        message: `Test not found for testId "${requestedId}".`,
      })
      return
    }

    const { questions: normalizedQuestions, error: questionError } = await loadTestQuestions(sourceTest)
    if (questionError) {
      res.status(422).json({ success: false, message: questionError })
      return
    }

    const rootTestId = getRootTestId(sourceTest)
    const previousAttempts = await TestAttempt.find(
      { userId: req.user.id, rootTestId },
      { _id: 0, attemptNumber: 1 },
    ).lean()
    const legacyAttempts = await Test.find(
      { owner: req.user.id, rootTestId },
      { _id: 0, attemptNumber: 1 },
    ).lean()
    const maxAttemptNumber = [...previousAttempts, ...legacyAttempts].reduce((maxValue, item) => {
      const attemptNumber = getAttemptNumber(item)
      return attemptNumber > maxValue ? attemptNumber : maxValue
    }, 0)
    const nextAttemptNumber = maxAttemptNumber + 1

    const attemptId = createAttemptId()
    await TestAttempt.create({
      attemptId,
      userId: req.user.id,
      testId: sourceTest.testId,
      rootTestId,
      attemptNumber: nextAttemptNumber,
      testName: sourceTest.testName,
      nickname: sourceTest.nickname || '',
      totalQuestions: sourceTest.totalQuestions,
      durationMinutes: sourceTest.durationMinutes,
      markingScheme: sourceTest.markingScheme,
      filters: sourceTest.filters,
      questions: normalizedQuestions,
    })

    res.json({
      success: true,
      data: {
        testId: attemptId,
        libraryTestId: sourceTest.testId,
        testNumber: sourceTest.testNumber,
        displayNumber: toDisplayNumber(sourceTest.testNumber, nextAttemptNumber),
        rootTestId,
        sourceTestId: sourceTest.testId,
        attemptNumber: nextAttemptNumber,
        testName: sourceTest.testName,
        nickname: sourceTest.nickname || '',
        markingScheme: sourceTest.markingScheme,
        durationMinutes: sourceTest.durationMinutes,
        totalQuestions: sourceTest.totalQuestions,
        questions: normalizedQuestions,
      },
    })
  } catch (error) {
    next(error)
  }
})

router.get('/:testId/review', async (req, res, next) => {
  try {
    const testId = String(req.params.testId || '').trim()
    const test = await Test.findOne({ testId, attemptNumber: 1 }).lean()
    if (!test) {
      res.status(404).json({ success: false, message: 'Test not found.' })
      return
    }

    const attempt = await TestAttempt.findOne({
      rootTestId: getRootTestId(test),
      userId: req.user.id,
      completionStatus: 'completed',
      result: { $ne: null },
    }).sort({ 'result.submittedAt': -1, createdAt: -1 }).lean()
    if (!attempt) {
      res.status(404).json({
        success: false,
        message: 'No completed attempt with saved answers is available for this test.',
      })
      return
    }

    const legacyCompleted = await Test.find(
      { owner: req.user.id, rootTestId: getRootTestId(test), result: { $ne: null } },
      { _id: 0, testId: 1, rootTestId: 1, attemptNumber: 1, result: 1, createdAt: 1 },
    ).lean()
    const latestResult = summarizeAttempts([
      ...legacyCompleted,
      { ...attempt, testId: attempt.attemptId },
    ])[0]
    if (latestResult.resultTestId !== attempt.attemptId) {
      res.status(422).json({
        success: false,
        message: 'The latest completed attempt is an older result without saved answers and cannot be reviewed.',
      })
      return
    }

    let questions = attempt.questions
    let answers = attempt.answers || {}
    const reconstructed = !Array.isArray(questions) || questions.length === 0
    if (reconstructed) {
      const loaded = await loadTestQuestions(test)
      if (loaded.error) {
        res.status(422).json({ success: false, message: loaded.error })
        return
      }
      questions = loaded.questions
      const savedAnswers = answers || {}
      answers = {}
      for (const question of questions) {
        const answer = savedAnswers[question.questionId] ?? savedAnswers[question.id]
        if (answer !== undefined) answers[question.id] = answer
      }
    }

    const validQuestions = questions.length === attempt.totalQuestions && questions.every((question) =>
      question.id != null &&
      typeof question.question === 'string' &&
      Array.isArray(question.options) &&
      Number.isInteger(question.correctOption) &&
      question.correctOption >= 0 &&
      question.correctOption < question.options.length,
    )
    const selectedAnswers = questions.map((question) => answers[question.id]).filter((answer) => answer !== undefined)
    if (
      !validQuestions ||
      selectedAnswers.length !== attempt.result.correct + attempt.result.incorrect ||
      questions.some((question) => {
        const answer = answers[question.id]
        return answer !== undefined && (!Number.isInteger(answer) || answer < 0 || answer >= question.options.length)
      })
    ) {
      res.status(422).json({
        success: false,
        message: 'This attempt cannot be reviewed because its saved questions or answers are incomplete.',
      })
      return
    }

    res.json({
      success: true,
      data: {
        questions,
        answers,
        reconstructed,
        result: {
          ...attempt.result,
          correctMarks: attempt.markingScheme.correct,
          incorrectMarks: attempt.markingScheme.incorrect,
        },
        displayNumber: toDisplayNumber(test.testNumber, getAttemptNumber(attempt)),
        nickname: attempt.nickname || '',
      },
    })
  } catch (error) {
    next(error)
  }
})

router.post('/:testId/result', async (req, res, next) => {
  try {
    const submittedTestId = String(req.params.testId || '').trim()
    if (!submittedTestId) {
      res.status(400).json({ success: false, message: 'testId is required.' })
      return
    }

    const payload = req.body || {}
    const answers =
      payload.answers && typeof payload.answers === 'object' && !Array.isArray(payload.answers)
        ? payload.answers
        : {}

    const attempt = await TestAttempt.findOne(
      { attemptId: submittedTestId, userId: req.user.id },
      { _id: 0, attemptId: 1, totalQuestions: 1, markingScheme: 1 },
    ).lean()
    if (attempt) {
      const totalQuestions = Number(attempt.totalQuestions)
      if (!Number.isInteger(totalQuestions) || totalQuestions <= 0) {
        throw new Error(`Invalid totalQuestions for attempt "${submittedTestId}".`)
      }
      const result = buildAttemptResult(payload, attempt)

      const updated = await TestAttempt.findOneAndUpdate(
        { attemptId: submittedTestId, userId: req.user.id },
        {
          $set: {
            answers,
            completionStatus: 'completed',
            result,
          },
        },
        { new: true, projection: { result: 1 } },
      ).lean()

      res.json({ success: true, data: updated?.result || result })
      return
    }

    const legacyTest = await Test.findOne(
      { testId: submittedTestId, owner: req.user.id },
      { totalQuestions: 1, markingScheme: 1 },
    ).lean()
    if (!legacyTest) {
      res.status(404).json({ success: false, message: 'Test attempt not found.' })
      return
    }

    const totalQuestions = Number(legacyTest.totalQuestions)
    if (!Number.isInteger(totalQuestions) || totalQuestions <= 0) {
      throw new Error(`Invalid totalQuestions for legacy test "${submittedTestId}".`)
    }
    const result = buildAttemptResult(payload, legacyTest)

    const updatedLegacy = await Test.findOneAndUpdate(
      { testId: submittedTestId, owner: req.user.id },
      { $set: { result } },
      { new: true, projection: { result: 1 } },
    ).lean()

    res.json({ success: true, data: updatedLegacy?.result || result })
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
    if (includeAllOwners) {
      const test = await Test.findOne({ testId, attemptNumber: 1 }).lean()
      if (!test) {
        res.status(404).json({
          success: false,
          message: `Test not found for testId "${testId}".`,
        })
        return
      }

      const rootNumbers = await getRootNumbers('', [test])
      const summaries = await loadUserSummaries([getRootTestId(test)], req.user.id)
      const summary = summaries.get(getRootTestId(test))

      res.json({
        success: true,
        data: {
          ...test,
          displayNumber: getDisplayNumber(
            { ...test, attemptNumber: 1 },
            rootNumbers.get(getRootTestId(test)),
          ),
          rootTestId: test.rootTestId || test.testId,
          sourceTestId: test.sourceTestId || null,
          attemptNumber: 1,
          result: summary?.result || null,
          resultAttemptNumber: summary?.resultAttemptNumber || null,
          completionStatus: summary?.completionStatus || (summary?.result ? 'completed' : 'in_progress'),
          userAttemptNumber: summary?.userAttemptNumber || 0,
        },
      })
      return
    }

    const attempt = await TestAttempt.findOne({
      attemptId: testId,
      userId: req.user.id,
    }).lean()
    if (attempt) {
      const libraryTest = await Test.findOne(
        { testId: attempt.testId },
        { _id: 0, owner: 1, sourceTestId: 1, testNumber: 1, createdAt: 1 },
      ).lean()
      res.json({
        success: true,
        data: {
          testId: attempt.attemptId,
          libraryTestId: attempt.testId,
          owner: libraryTest?.owner || '',
          testName: attempt.testName,
          nickname: attempt.nickname || '',
          totalQuestions: attempt.totalQuestions,
          durationMinutes: attempt.durationMinutes,
          markingScheme: attempt.markingScheme,
          filters: attempt.filters || {},
          result: attempt.result || null,
          completionStatus: attempt.completionStatus || 'in_progress',
          rootTestId: attempt.rootTestId || attempt.testId,
          sourceTestId: libraryTest?.sourceTestId || null,
          attemptNumber: getAttemptNumber(attempt),
          displayNumber: toDisplayNumber(libraryTest?.testNumber, getAttemptNumber(attempt)),
          createdAt: attempt.createdAt || attempt.startedAt || libraryTest?.createdAt,
        },
      })
      return
    }

    await backfillTestNumbers(req.user.id)
    const legacyTest = await Test.findOne({ testId, owner: req.user.id }).lean()
    if (!legacyTest) {
      res.status(404).json({
        success: false,
        message: `Test not found for testId "${testId}".`,
      })
      return
    }
    const rootNumbers = await getRootNumbers(req.user.id, [legacyTest])
    res.json({
      success: true,
      data: {
        ...legacyTest,
        displayNumber: getDisplayNumber(
          { ...legacyTest, attemptNumber: getAttemptNumber(legacyTest) },
          rootNumbers.get(getRootTestId(legacyTest)),
        ),
        rootTestId: legacyTest.rootTestId || legacyTest.testId,
        sourceTestId: legacyTest.sourceTestId || null,
        attemptNumber: getAttemptNumber(legacyTest),
      },
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
