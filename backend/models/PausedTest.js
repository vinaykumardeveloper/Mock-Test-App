const mongoose = require('mongoose')

const pausedTestSchema = new mongoose.Schema(
  {
    owner: { type: String, required: true, trim: true, index: true },
    testId: { type: String, trim: true, default: '' },
    displayNumber: { type: String, trim: true, default: '' },
    testName: { type: String, required: true, trim: true },
    nickname: { type: String, trim: true, default: '' },
    markingScheme: {
      correct: { type: Number, default: 1 },
      incorrect: { type: Number, default: 0 },
    },
    durationSeconds: { type: Number, required: true, min: 1 },
    secondsLeft: { type: Number, required: true, min: 0 },
    currentQuestionIndex: { type: Number, default: 0, min: 0 },
    questions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
    visitedQuestionIds: { type: mongoose.Schema.Types.Mixed, default: {} },
    reviewQuestionIds: { type: mongoose.Schema.Types.Mixed, default: {} },
    startedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, collection: 'pausedTests', minimize: false },
)

pausedTestSchema.index({ owner: 1, testId: 1, updatedAt: -1 })

module.exports = mongoose.model('PausedTest', pausedTestSchema)
