const express = require('express')
const mongoose = require('mongoose')
const { isDbConnected } = require('../config/db')
const PausedTest = require('../models/PausedTest')
const Test = require('../models/Test')
const { getDisplayNumber, getRootNumbers, nextTestNumber } = require('../utils/testNumber')

const router = express.Router()

router.use((req, res, next) => {
  if (isDbConnected()) {
    next()
    return
  }

  res.status(503).json({
    success: false,
    message: 'Database is not connected. Please check MongoDB Atlas whitelist and credentials.',
  })
})

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function buildPayload(body) {
  const questions = Array.isArray(body?.questions) ? body.questions : []
  const durationSeconds = Number(body?.durationSeconds)
  const secondsLeft = Number(body?.secondsLeft)
  const currentQuestionIndex = Number(body?.currentQuestionIndex)
  const testName = String(body?.testName || '').trim()
  const startedAt = new Date(body?.startedAt || Date.now())

  if (questions.length === 0 || questions.length > 500 || !testName) {
    return { error: 'A test name and at least one question are required.' }
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { error: 'Invalid test duration.' }
  }
  if (!Number.isFinite(secondsLeft) || secondsLeft < 0) {
    return { error: 'Invalid remaining time.' }
  }
  if (Number.isNaN(startedAt.getTime())) {
    return { error: 'Invalid start time.' }
  }

  return {
    data: {
      testId: String(body?.testId || '').trim(),
      displayNumber: String(body?.displayNumber || '').trim().slice(0, 20),
      testName,
      nickname: String(body?.nickname || '').trim().slice(0, 40),
      markingScheme: {
        correct: Number.isFinite(Number(body?.markingScheme?.correct))
          ? Number(body.markingScheme.correct)
          : 1,
        incorrect: Number.isFinite(Number(body?.markingScheme?.incorrect))
          ? Number(body.markingScheme.incorrect)
          : 0,
      },
      durationSeconds: Math.trunc(durationSeconds),
      secondsLeft: Math.min(Math.trunc(secondsLeft), Math.trunc(durationSeconds)),
      currentQuestionIndex:
        Number.isInteger(currentQuestionIndex) &&
        currentQuestionIndex >= 0 &&
        currentQuestionIndex < questions.length
          ? currentQuestionIndex
          : 0,
      questions,
      answers: isPlainObject(body?.answers) ? body.answers : {},
      visitedQuestionIds: isPlainObject(body?.visitedQuestionIds) ? body.visitedQuestionIds : {},
      reviewQuestionIds: isPlainObject(body?.reviewQuestionIds) ? body.reviewQuestionIds : {},
      startedAt,
    },
  }
}

router.get('/', async (req, res, next) => {
  try {
    const rows = await PausedTest.find(
      { owner: req.user.id },
      { testName: 1, nickname: 1, displayNumber: 1, secondsLeft: 1, durationSeconds: 1, updatedAt: 1, answers: 1, questions: 1 },
    )
      .sort({ updatedAt: -1 })
      .lean()

    const testIds = rows.map((row) => row.testId).filter(Boolean)
    const tests = await Test.find(
      { owner: req.user.id, testId: { $in: testIds } },
      { testId: 1, rootTestId: 1, testNumber: 1, attemptNumber: 1 },
    ).lean()
    const rootNumbers = await getRootNumbers(req.user.id, tests)
    const testNumberById = new Map(
      tests.map((test) => [
        test.testId,
        getDisplayNumber(test, rootNumbers.get(test.rootTestId || test.testId)),
      ]),
    )
    const displayNumberByPausedId = new Map()
    for (const row of rows) {
      let displayNumber = testNumberById.get(row.testId) || row.displayNumber
      if (!displayNumber) {
        displayNumber = String(await nextTestNumber(req.user.id))
        await PausedTest.updateOne(
          { _id: row._id, owner: req.user.id },
          { $set: { displayNumber } },
        )
      }
      displayNumberByPausedId.set(String(row._id), displayNumber)
    }

    res.json({
      success: true,
      data: rows.map((row) => ({
        id: row._id,
        testName: row.testName,
        nickname: row.nickname || '',
        displayNumber: displayNumberByPausedId.get(String(row._id)),
        secondsLeft: row.secondsLeft,
        durationSeconds: row.durationSeconds,
        totalQuestions: row.questions.length,
        answeredCount: Object.keys(row.answers || {}).length,
        pausedAt: row.updatedAt,
      })),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ success: false, message: 'Invalid paused test id.' })
      return
    }

    const row = await PausedTest.findOne({ _id: req.params.id, owner: req.user.id }).lean()
    if (!row) {
      res.status(404).json({ success: false, message: 'Paused test not found.' })
      return
    }

    let displayNumber = null
    if (row.testId) {
      const test = await Test.findOne(
        { owner: req.user.id, testId: row.testId },
        { testId: 1, rootTestId: 1, testNumber: 1, attemptNumber: 1 },
      ).lean()
      if (test) {
        const rootNumbers = await getRootNumbers(req.user.id, [test])
        displayNumber = getDisplayNumber(test, rootNumbers.get(test.rootTestId || test.testId))
      }
    }
    displayNumber = displayNumber || row.displayNumber

    if (!displayNumber) {
      displayNumber = String(await nextTestNumber(req.user.id))
      await PausedTest.updateOne(
        { _id: row._id, owner: req.user.id },
        { $set: { displayNumber } },
      )
    }

    res.json({ success: true, data: { ...row, id: row._id, displayNumber } })
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const { data, error } = buildPayload(req.body)
    if (error) {
      res.status(400).json({ success: false, message: error })
      return
    }

    const created = await PausedTest.create({ ...data, owner: req.user.id })
    res.json({ success: true, data: { id: created._id } })
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ success: false, message: 'Invalid paused test id.' })
      return
    }

    const { data, error } = buildPayload(req.body)
    if (error) {
      res.status(400).json({ success: false, message: error })
      return
    }

    const updated = await PausedTest.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id },
      data,
      { new: true },
    )
    if (!updated) {
      res.status(404).json({ success: false, message: 'Paused test not found.' })
      return
    }

    res.json({ success: true, data: { id: updated._id } })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ success: false, message: 'Invalid paused test id.' })
      return
    }

    await PausedTest.deleteOne({ _id: req.params.id, owner: req.user.id })
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

module.exports = router
