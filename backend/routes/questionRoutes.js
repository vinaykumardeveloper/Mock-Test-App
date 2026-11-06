const express = require('express')
const crypto = require('crypto')
const { isDbConnected } = require('../config/db')
const Question = require('../models/Question')
const Test = require('../models/Test')
const TestAttempt = require('../models/TestAttempt')
const { nextTestNumber } = require('../utils/testNumber')
const { normalizeQuestionOptions } = require('../utils/questionOptions')

const router = express.Router()
const OPTION_LABELS = ['A', 'B', 'C', 'D']
const CANONICAL_DIFFICULTIES = ['easy', 'moderate', 'hard']
const DIFFICULTY_ALIASES = {
  easy: 'easy',
  moderate: 'moderate',
  medium: 'moderate',
  hard: 'hard',
  difficult: 'hard',
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

router.get('/subjects', async (req, res, next) => {
  try {
    const rows = await Question.aggregate([
      {
        $match: {
          subject: { $type: 'string', $ne: '' },
        },
      },
      {
        $group: {
          _id: { $trim: { input: '$subject' } },
          questionCount: { $sum: 1 },
        },
      },
      {
        $match: {
          _id: { $ne: '' },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ])

    res.json({
      success: true,
      data: rows.map((row) => ({
        subject: row._id,
        questionCount: row.questionCount,
      })),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/chapters', async (req, res, next) => {
  try {
    const subject = String(req.query.subject || '').trim()
    if (!subject) {
      res.status(400).json({
        success: false,
        message: 'Query param "subject" is required.',
      })
      return
    }

    const rows = await Question.aggregate([
      {
        $match: {
          subject,
          chapter: { $type: 'string', $ne: '' },
        },
      },
      {
        $group: {
          _id: { $trim: { input: '$chapter' } },
          questionCount: { $sum: 1 },
        },
      },
      {
        $match: {
          _id: { $ne: '' },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ])

    res.json({
      success: true,
      data: rows.map((row) => ({
        chapter: row._id,
        questionCount: row.questionCount,
      })),
    })
  } catch (error) {
    next(error)
  }
})

function shuffle(values) {
  const arr = [...values]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

function normalizeDifficulty(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  return DIFFICULTY_ALIASES[normalized] || null
}

function getDifficultyFilterMeta(difficulties) {
  const selected = new Set(
    (Array.isArray(difficulties) ? difficulties : [])
      .map((difficulty) => normalizeDifficulty(difficulty))
      .filter(Boolean),
  )
  const isAllLevelsSelected = CANONICAL_DIFFICULTIES.every((level) => selected.has(level))
  return { selected, isAllLevelsSelected }
}

function toDifficultyLabel(value) {
  const normalized = normalizeDifficulty(value)
  if (normalized === 'easy') {
    return 'Easy'
  }
  if (normalized === 'moderate') {
    return 'Moderate'
  }
  if (normalized === 'hard') {
    return 'Hard'
  }
  return null
}

function createTestId() {
  return `TST-${crypto.randomUUID()}`
}

function createAttemptId() {
  return `ATT-${crypto.randomUUID()}`
}

function normalizeQuestion(questionDoc, index) {
  const questionText = String(questionDoc.question || '').trim()
  if (!questionText) {
    return { question: null, exclusionReason: 'missingQuestionText' }
  }

  const options = normalizeQuestionOptions(questionDoc.options)

  if (options.length < 4) {
    return { question: null, exclusionReason: 'insufficientOptions' }
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
    return { question: null, exclusionReason: 'invalidCorrectAnswer' }
  }

  const rawQuestionNumber = Number(questionDoc.questionNumber)
  const normalizedQuestionNumber =
    Number.isInteger(rawQuestionNumber) && rawQuestionNumber > 0 ? rawQuestionNumber : null

  return {
    question: {
      id: String(questionDoc._id || index + 1),
      questionNumber: normalizedQuestionNumber,
      chapter: String(questionDoc.chapter || '').trim(),
      subject: String(questionDoc.subject || '').trim(),
      topic: String(questionDoc.topic || '').trim(),
      difficulty: String(questionDoc.difficulty || '').trim(),
      difficultyKey: normalizeDifficulty(questionDoc.difficulty),
      question: questionText,
      options: options.slice(0, 4),
      correctOption,
    },
    exclusionReason: null,
  }
}

router.post('/create-test', async (req, res, next) => {
  try {
    const legacySubject = String(req.body?.subject || '').trim()
    const legacyChapters = Array.isArray(req.body?.chapters)
      ? req.body.chapters.map((chapter) => String(chapter || '').trim()).filter(Boolean)
      : []
    const requestedTotal = Number(req.body?.totalQuestions)
    const selectionsInput = Array.isArray(req.body?.selections)
      ? req.body.selections
      : legacySubject
        ? (Array.isArray(req.body?.chapterFilters) && req.body.chapterFilters.length > 0
            ? req.body.chapterFilters
            : legacyChapters.map((chapter) => ({ chapter }))
          ).map((item) => ({ ...item, subject: legacySubject }))
        : []
    const makeKey = (subjectName, chapterName) => `${subjectName}||${chapterName}`
    const selectionKeys = new Set()
    const selections = []
    for (const item of selectionsInput) {
      const itemSubject = String(item?.subject || '').trim()
      const itemChapter = String(item?.chapter || '').trim()
      const key = makeKey(itemSubject, itemChapter)
      if (!itemSubject || !itemChapter || selectionKeys.has(key)) {
        continue
      }
      selectionKeys.add(key)
      selections.push({ ...item, subject: itemSubject, chapter: itemChapter, key })
    }
    const chapters = selections.map((item) => item.key)
    const subjectNames = [...new Set(selections.map((item) => item.subject))]
    const subject = subjectNames.join(', ')
    const chapterLabel = (key) => key.replace('||', ' / ')
    const chapterFiltersInput = selections

    if (selections.length === 0) {
      res.status(400).json({ success: false, message: 'Select at least one subject and chapter.' })
      return
    }
    if (!Number.isInteger(requestedTotal) || requestedTotal <= 0) {
      res.status(400).json({ success: false, message: 'Total questions must be a positive integer.' })
      return
    }

    const chapterFilterMap = new Map()
    for (const item of chapterFiltersInput) {
      const chapterName = item.key
      const difficulties = Array.isArray(item?.difficulties)
        ? item.difficulties
            .map((difficulty) => String(difficulty || '').trim())
            .filter(Boolean)
        : []
      const difficultyMeta = getDifficultyFilterMeta(difficulties)
      const startQuestionNumber =
        item?.startQuestionNumber === '' || item?.startQuestionNumber === undefined
          ? null
          : Number(item.startQuestionNumber)
      const endQuestionNumber =
        item?.endQuestionNumber === '' || item?.endQuestionNumber === undefined
          ? null
          : Number(item.endQuestionNumber)

      chapterFilterMap.set(chapterName, {
        difficulties: [...difficultyMeta.selected],
        isAllLevelsSelected: difficultyMeta.isAllLevelsSelected,
        startQuestionNumber:
          Number.isInteger(startQuestionNumber) && startQuestionNumber > 0
            ? startQuestionNumber
            : null,
        endQuestionNumber:
          Number.isInteger(endQuestionNumber) && endQuestionNumber > 0
            ? endQuestionNumber
            : null,
      })
    }

    for (const chapter of chapters) {
      const filter = chapterFilterMap.get(chapter)
      if (!filter) {
        continue
      }
      if (
        filter.startQuestionNumber !== null &&
        filter.endQuestionNumber !== null &&
        filter.startQuestionNumber > filter.endQuestionNumber
      ) {
        res.status(400).json({
          success: false,
          message: `Invalid question number range for chapter "${chapterLabel(chapter)}".`,
        })
        return
      }
      if (Array.isArray(filter.difficulties) && filter.difficulties.length === 0) {
        res.status(400).json({
          success: false,
          message: `Select at least one valid difficulty for chapter "${chapterLabel(chapter)}".`,
        })
        return
      }
    }

    const totalQuestionsInCollection = await Question.countDocuments({})
    const docs = await Question.find({
      $or: selections.map((item) => ({ subject: item.subject, chapter: item.chapter })),
    }).lean()

    const normalizationExclusions = {
      missingQuestionText: 0,
      insufficientOptions: 0,
      invalidCorrectAnswer: 0,
    }
    const normalized = []
    for (let index = 0; index < docs.length; index += 1) {
      const { question, exclusionReason } = normalizeQuestion(docs[index], index)
      if (question) {
        normalized.push(question)
        continue
      }
      if (exclusionReason && normalizationExclusions[exclusionReason] !== undefined) {
        normalizationExclusions[exclusionReason] += 1
      }
    }

    const byChapter = new Map()
    const filteredQuestions = []
    const filterDiagnostics = {
      totalQuestionsInCollection,
      subjectChapterQuestions: docs.length,
      normalizedQuestions: normalized.length,
      normalizationExclusions,
      excludedByDifficulty: 0,
      excludedByUnknownDifficulty: 0,
      excludedByRange: 0,
      excludedByMissingQuestionNumberForRange: 0,
      matchedDifficulty: 0,
      matchedRangeAndDifficulty: 0,
      finalMatchingQuestions: 0,
      finalGeneratedQuestions: 0,
    }
    for (const chapter of chapters) {
      byChapter.set(chapter, [])
    }
    for (const question of normalized) {
      const questionKey = makeKey(question.subject, question.chapter)
      if (byChapter.has(questionKey)) {
        const filter = chapterFilterMap.get(questionKey) || {
          difficulties: [...CANONICAL_DIFFICULTIES],
          isAllLevelsSelected: true,
          startQuestionNumber: null,
          endQuestionNumber: null,
        }
        const hasRangeFilter =
          filter.startQuestionNumber !== null || filter.endQuestionNumber !== null
        const questionNumber =
          Number.isInteger(question.questionNumber) && question.questionNumber > 0
            ? question.questionNumber
            : null
        const matchesDifficulty =
          filter.isAllLevelsSelected ||
          (question.difficultyKey !== null && filter.difficulties.includes(question.difficultyKey))
        if (matchesDifficulty) {
          filterDiagnostics.matchedDifficulty += 1
        } else if (question.difficultyKey === null) {
          filterDiagnostics.excludedByUnknownDifficulty += 1
        } else {
          filterDiagnostics.excludedByDifficulty += 1
        }
        const matchesStart =
          filter.startQuestionNumber === null ||
          (questionNumber !== null && questionNumber >= filter.startQuestionNumber)
        const matchesEnd =
          filter.endQuestionNumber === null ||
          (questionNumber !== null && questionNumber <= filter.endQuestionNumber)
        const matchesRange = matchesStart && matchesEnd

        if (matchesDifficulty && !matchesRange) {
          if (hasRangeFilter && questionNumber === null) {
            filterDiagnostics.excludedByMissingQuestionNumberForRange += 1
          } else {
            filterDiagnostics.excludedByRange += 1
          }
        }

        if (matchesDifficulty && matchesRange) {
          filterDiagnostics.matchedRangeAndDifficulty += 1
          byChapter.get(questionKey).push(question)
          filteredQuestions.push(question)
        }
      }
    }

    const emptyChapters = chapters.filter((chapter) => byChapter.get(chapter).length === 0)
    if (emptyChapters.length > 0) {
      res.status(422).json({
        success: false,
        message: `No valid questions found in selected chapter(s): ${emptyChapters.map(chapterLabel).join(', ')}`,
      })
      return
    }

    const totalAvailable = chapters.reduce(
      (sum, chapter) => sum + byChapter.get(chapter).length,
      0,
    )
    filterDiagnostics.finalMatchingQuestions = totalAvailable

    if (requestedTotal > totalAvailable) {
      console.log(
        `[create-test] ${JSON.stringify({
          subject,
          chapters,
          requestedTotal,
          chapterFilters: [...chapterFilterMap.entries()],
          diagnostics: filterDiagnostics,
        })}`,
      )
      res.status(422).json({
        success: false,
        message: `Requested ${requestedTotal} questions, but only ${totalAvailable} valid questions are available.`,
      })
      return
    }

    const basePerChapter = Math.floor(requestedTotal / chapters.length)
    let remainder = requestedTotal % chapters.length
    const selected = []
    const selectedIds = new Set()

    for (const chapter of chapters) {
      const quota = basePerChapter + (remainder > 0 ? 1 : 0)
      if (remainder > 0) {
        remainder -= 1
      }
      const pool = shuffle(byChapter.get(chapter))
      const picks = pool.slice(0, quota)
      for (const question of picks) {
        selected.push(question)
        selectedIds.add(question.id)
      }
    }

    let remainingNeeded = requestedTotal - selected.length
    if (remainingNeeded > 0) {
      const leftovers = shuffle(
        filteredQuestions.filter((question) => !selectedIds.has(question.id)),
      )
      for (const question of leftovers) {
        if (remainingNeeded <= 0) {
          break
        }
        selected.push(question)
        selectedIds.add(question.id)
        remainingNeeded -= 1
      }
    }

    const distribution = chapters.map((chapter) => ({
      subject: chapter.split('||')[0],
      chapter: chapter.split('||')[1],
      questionCount: selected.filter(
        (question) => makeKey(question.subject, question.chapter) === chapter,
      ).length,
    }))
    filterDiagnostics.finalGeneratedQuestions = selected.length

    const generatedQuestions = shuffle(selected).map((question, index) => ({
      ...question,
      questionId: question.id,
      id: index + 1,
    }))

    const questionReferences = generatedQuestions.map((question, index) => ({
      questionId: question.questionId,
      order: index + 1,
    }))
    const uniqueQuestionReferenceCount = new Set(
      questionReferences.map((question) => String(question.questionId)),
    ).size
    if (uniqueQuestionReferenceCount !== questionReferences.length) {
      throw new Error('Generated test contains duplicate question references.')
    }

    const chapterFilters = chapters.map((chapter) => {
      const filter = chapterFilterMap.get(chapter)
      if (filter) {
        return filter
      }
      return {
        difficulties: [...CANONICAL_DIFFICULTIES],
        isAllLevelsSelected: true,
        startQuestionNumber: null,
        endQuestionNumber: null,
      }
    })
    const starts = chapterFilters
      .map((filter) => filter.startQuestionNumber)
      .filter((value) => Number.isInteger(value) && value > 0)
    const ends = chapterFilters
      .map((filter) => filter.endQuestionNumber)
      .filter((value) => Number.isInteger(value) && value > 0)
    const selectedDifficultySet = new Set()
    for (const filter of chapterFilters) {
      if (filter.isAllLevelsSelected) {
        selectedDifficultySet.add('Easy')
        selectedDifficultySet.add('Moderate')
        selectedDifficultySet.add('Hard')
        continue
      }
      for (const item of filter.difficulties) {
        const label = toDifficultyLabel(item)
        if (label) {
          selectedDifficultySet.add(label)
        }
      }
    }

    const requestedDurationMinutes = Number(req.body?.durationMinutes)
    const durationMinutes =
      Number.isInteger(requestedDurationMinutes) && requestedDurationMinutes > 0
        ? requestedDurationMinutes
        : 30
    const requestedMarkingScheme = req.body?.markingScheme || {}
    const correctMarks = Number(requestedMarkingScheme.correct)
    const incorrectMarks = Number(requestedMarkingScheme.incorrect)
    const markingScheme = {
      correct: Number.isFinite(correctMarks) ? correctMarks : 1,
      incorrect: Number.isFinite(incorrectMarks) ? -Math.abs(incorrectMarks) : 0,
    }
    const nickname = String(req.body?.nickname || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40)
    const testName = `Mock Test • ${subject} • ${selections.map((item) => item.chapter).join(', ')}`
    const testId = createTestId()
    const testNumber = await nextTestNumber(req.user.id)

    await Test.create({
      testId,
      owner: req.user.id,
      testNumber,
      rootTestId: testId,
      sourceTestId: null,
      attemptNumber: 1,
      testName,
      nickname,
      totalQuestions: generatedQuestions.length,
      durationMinutes,
      markingScheme,
      filters: {
        subjects: subjectNames,
        chapters: selections.map((item) => item.chapter),
        topics: [],
        difficulty: [...selectedDifficultySet],
        questionNumberRange: {
          from: starts.length > 0 ? Math.min(...starts) : null,
          to: ends.length > 0 ? Math.max(...ends) : null,
        },
      },
      questions: questionReferences,
    })

    const attemptId = createAttemptId()
    await TestAttempt.create({
      attemptId,
      userId: req.user.id,
      testId,
      rootTestId: testId,
      attemptNumber: 1,
      testName,
      nickname,
      totalQuestions: generatedQuestions.length,
      durationMinutes,
      markingScheme,
      questions: generatedQuestions,
      filters: {
        subjects: subjectNames,
        chapters: selections.map((item) => item.chapter),
        topics: [],
        difficulty: [...selectedDifficultySet],
        questionNumberRange: {
          from: starts.length > 0 ? Math.min(...starts) : null,
          to: ends.length > 0 ? Math.max(...ends) : null,
        },
      },
    })

    console.log(
      `[create-test] ${JSON.stringify({
        subject,
        chapters,
        requestedTotal,
        chapterFilters: [...chapterFilterMap.entries()],
        diagnostics: filterDiagnostics,
      })}`,
    )

    res.json({
      success: true,
      data: {
        testId: attemptId,
        libraryTestId: testId,
        testNumber,
        displayNumber: String(testNumber),
        testName,
        nickname,
        markingScheme,
        subject,
        subjects: subjectNames,
        chapters: selections.map((item) => item.chapter),
        requestedTotal,
        generatedTotal: selected.length,
        distribution,
        questions: generatedQuestions,
      },
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
