const mongoose = require('mongoose')

const attemptResultSchema = new mongoose.Schema(
  {
    correct: { type: Number, default: 0 },
    incorrect: { type: Number, default: 0 },
    notAnswered: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    submittedAt: { type: Date, default: null },
  },
  { _id: false },
)

const questionSnapshotSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctOption: { type: Number, required: true },
  },
  { _id: false },
)

const testAttemptSchema = new mongoose.Schema(
  {
    attemptId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    testId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    rootTestId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    attemptNumber: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    testName: {
      type: String,
      required: true,
      trim: true,
    },
    nickname: {
      type: String,
      trim: true,
      default: '',
    },
    totalQuestions: {
      type: Number,
      required: true,
      min: 1,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    markingScheme: {
      correct: { type: Number, required: true },
      incorrect: { type: Number, required: true },
    },
    filters: {
      subjects: { type: [String], default: [] },
      chapters: { type: [String], default: [] },
      topics: { type: [String], default: [] },
      difficulty: { type: [String], default: [] },
      questionNumberRange: {
        from: { type: Number, min: 1, default: null },
        to: { type: Number, min: 1, default: null },
      },
    },
    answers: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    questions: {
      type: [questionSnapshotSchema],
      default: undefined,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    completionStatus: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress',
      index: true,
    },
    result: {
      type: attemptResultSchema,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'testAttempts',
    minimize: false,
  },
)

testAttemptSchema.index({ userId: 1, testId: 1 })
testAttemptSchema.index({ userId: 1, rootTestId: 1, attemptNumber: 1 }, { unique: true })
testAttemptSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model('TestAttempt', testAttemptSchema)
