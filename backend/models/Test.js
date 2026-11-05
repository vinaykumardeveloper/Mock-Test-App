const mongoose = require('mongoose')

const SUPPORTED_DIFFICULTIES = ['Easy', 'Moderate', 'Hard']

const testQuestionSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    _id: false,
  },
)

const testSchema = new mongoose.Schema(
  {
    testId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    owner: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    testNumber: {
      type: Number,
      min: 1,
      default: null,
    },
    rootTestId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    sourceTestId: {
      type: String,
      trim: true,
      default: null,
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
      correct: {
        type: Number,
        required: true,
      },
      incorrect: {
        type: Number,
        required: true,
      },
    },
    result: {
      type: new mongoose.Schema(
        {
          correct: { type: Number, default: 0 },
          incorrect: { type: Number, default: 0 },
          notAnswered: { type: Number, default: 0 },
          score: { type: Number, default: 0 },
          maxScore: { type: Number, default: 0 },
          submittedAt: { type: Date, default: Date.now },
        },
        { _id: false },
      ),
      default: null,
    },
    filters: {
      subjects: {
        type: [String],
        default: [],
      },
      chapters: {
        type: [String],
        default: [],
      },
      topics: {
        type: [String],
        default: [],
      },
      difficulty: {
        type: [
          {
            type: String,
            enum: SUPPORTED_DIFFICULTIES,
          },
        ],
        default: [],
      },
      questionNumberRange: {
        from: {
          type: Number,
          min: 1,
          default: null,
        },
        to: {
          type: Number,
          min: 1,
          default: null,
        },
      },
    },
    questions: {
      type: [testQuestionSchema],
      validate: [
        {
          validator(values) {
            if (!Array.isArray(values) || values.length === 0) {
              return false
            }
            const questionIds = values.map((item) => String(item.questionId))
            return new Set(questionIds).size === questionIds.length
          },
          message: 'Duplicate questionId values are not allowed in a test.',
        },
        {
          validator(values) {
            return Array.isArray(values) && values.length === this.totalQuestions
          },
          message: 'questions length must match totalQuestions.',
        },
      ],
    },
  },
  {
    timestamps: true,
    collection: 'tests',
  },
)

testSchema.index({ createdAt: -1 })

module.exports = mongoose.model('Test', testSchema)
