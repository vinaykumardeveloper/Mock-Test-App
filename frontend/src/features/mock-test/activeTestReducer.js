import { TEST_DURATION_SECONDS, questions as defaultQuestions } from './data/questions'
import { normalizeQuestionList } from './utils/questionOptions'

export const DEFAULT_TEST_LABEL = 'Aptitude Mock Test'

export const activeTestActions = {
  start: 'START',
  resume: 'RESUME',
  setAnswer: 'SET_ANSWER',
  clearAnswer: 'CLEAR_ANSWER',
  toggleReview: 'TOGGLE_REVIEW',
  goToQuestion: 'GO_TO_QUESTION',
  reset: 'RESET',
}

export const initialActiveTest = {
  questions: normalizeQuestionList(defaultQuestions),
  testId: '',
  label: DEFAULT_TEST_LABEL,
  number: '',
  nickname: '',
  markingScheme: { correct: 1, incorrect: 0 },
  durationSeconds: TEST_DURATION_SECONDS,
  answers: {},
  visited: {},
  review: {},
  currentIndex: 0,
}

function normalizeMarkingScheme(scheme) {
  const correct = Number(scheme?.correct)
  const incorrect = Number(scheme?.incorrect)
  return {
    correct: Number.isFinite(correct) ? correct : 1,
    incorrect: Number.isFinite(incorrect) ? incorrect : 0,
  }
}

function markVisited(visited, questionId) {
  return { ...visited, [questionId]: true }
}

export function activeTestReducer(state, action) {
  switch (action.type) {
    case activeTestActions.start: {
      const { questions, label, number, testId, nickname, markingScheme, durationSeconds } =
        action.payload
      const normalizedQuestions = normalizeQuestionList(questions)
      const first = normalizedQuestions[0]
      return {
        questions: normalizedQuestions,
        testId: String(testId || ''),
        label: label || DEFAULT_TEST_LABEL,
        number: String(number || ''),
        nickname: String(nickname || ''),
        markingScheme: normalizeMarkingScheme(markingScheme),
        durationSeconds,
        answers: {},
        visited: first ? { [first.id]: true } : {},
        review: {},
        currentIndex: 0,
      }
    }

    case activeTestActions.resume: {
      const saved = action.payload
      const normalizedQuestions = normalizeQuestionList(saved.questions)
      return {
        questions: normalizedQuestions,
        testId: saved.testId || '',
        label: saved.testName,
        number: saved.displayNumber || '',
        nickname: saved.nickname || '',
        markingScheme: normalizeMarkingScheme(saved.markingScheme),
        durationSeconds: saved.durationSeconds,
        answers: saved.answers || {},
        visited: saved.visitedQuestionIds || {},
        review: saved.reviewQuestionIds || {},
        currentIndex: Number.isInteger(saved.currentQuestionIndex)
          ? Math.max(0, Math.min(saved.currentQuestionIndex, normalizedQuestions.length - 1))
          : 0,
      }
    }

    case activeTestActions.setAnswer: {
      const { questionId, optionIndex } = action.payload
      return {
        ...state,
        answers: { ...state.answers, [questionId]: optionIndex },
        visited: markVisited(state.visited, questionId),
      }
    }

    case activeTestActions.clearAnswer: {
      const { [action.payload.questionId]: removed, ...answers } = state.answers
      void removed
      return {
        ...state,
        answers,
        visited: markVisited(state.visited, action.payload.questionId),
      }
    }

    case activeTestActions.toggleReview: {
      const { questionId } = action.payload
      const { [questionId]: wasMarked, ...withoutQuestion } = state.review
      return {
        ...state,
        review: wasMarked ? withoutQuestion : { ...state.review, [questionId]: true },
        visited: markVisited(state.visited, questionId),
      }
    }

    case activeTestActions.goToQuestion: {
      const lastIndex = state.questions.length - 1
      const index = Math.max(0, Math.min(lastIndex, action.payload.index))
      const question = state.questions[index]
      return {
        ...state,
        currentIndex: index,
        visited: question ? markVisited(state.visited, question.id) : state.visited,
      }
    }

    case activeTestActions.reset:
      return initialActiveTest

    default:
      return state
  }
}
