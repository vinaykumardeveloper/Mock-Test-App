const mongoose = require('mongoose')

const questionSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      trim: true,
      default: '',
    },
    chapter: {
      type: String,
      trim: true,
      default: '',
    },
    topic: {
      type: String,
      trim: true,
      default: '',
    },
    difficulty: {
      type: String,
      trim: true,
      default: '',
    },
    questionNumber: {
      type: Number,
      min: 1,
    },
    question: {
      type: String,
      trim: true,
      default: '',
    },
    options: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    correctAnswer: {
      type: String,
      trim: true,
      default: '',
    },
    explanation: {
      type: String,
      trim: true,
      default: '',
    },
    source: {
      type: String,
      trim: true,
      default: '',
    },
    sourcePage: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: 'questions',
  },
)

module.exports = mongoose.model('Question', questionSchema)
