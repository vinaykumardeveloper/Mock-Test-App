import { formatDuration } from '../utils/format'
import { normalizeQuestionOptionTexts } from '../utils/questionOptions'
import { TestNumberBadge } from './TestNumberBadge'
import { TestTitle } from './TestTitle'

export function TestScreen({
  userIcon,
  questions,
  testTitle,
  testNumber,
  testNickname,
  answers,
  visitedQuestionIds,
  reviewQuestionIds,
  currentQuestionIndex,
  secondsLeft,
  onSelectAnswer,
  onClearAnswer,
  onToggleReview,
  onQuestionChange,
  onPrevious,
  onNext,
  onSubmit,
  onPause,
  isPausing,
  pauseError,
}) {
  const currentQuestion = questions[currentQuestionIndex]
  if (!currentQuestion) {
    return (
      <section className="test-layout">
        <article className="card question-card">
          <div className="page-heading">
            {userIcon}
            <div>
              <h3>Unable to load test question.</h3>
              <p className="sub-text">Please go back and create the test again.</p>
            </div>
          </div>
        </article>
      </section>
    )
  }

  const currentQuestionId = currentQuestion.id
  const currentQuestionOptions = normalizeQuestionOptionTexts(currentQuestion.options)
  const hasCurrentAnswer = answers[currentQuestionId] !== undefined
  const isCurrentMarkedForReview = Boolean(reviewQuestionIds[currentQuestionId])
  const sequenceQuestionNumber = currentQuestionIndex + 1

  function isAnsweredAndReview(questionId) {
    return answers[questionId] !== undefined && Boolean(reviewQuestionIds[questionId])
  }

  function getPaletteClass(questionId) {
    const isAnswered = answers[questionId] !== undefined
    const isMarkedForReview = Boolean(reviewQuestionIds[questionId])
    const isVisited = Boolean(visitedQuestionIds[questionId])

    if (isAnswered && isMarkedForReview) {
      return 'answered-review'
    }
    if (isMarkedForReview) {
      return 'review'
    }
    if (isAnswered) {
      return 'answered'
    }
    if (isVisited) {
      return 'visited'
    }
    return 'unvisited'
  }

  return (
    <section className="test-layout">
      <header className="test-header card">
        <div className="page-heading">
          {userIcon}
          <div>
            <TestNumberBadge number={testNumber} nickname={testNickname} size="large" />
            <h2 className="test-header-title">
              <TestTitle name={testTitle} />
            </h2>
            <p className="sub-text">
              Question {currentQuestionIndex + 1} of {questions.length}
            </p>
          </div>
        </div>
        <div className="test-header-controls">
          <div className="timer">{formatDuration(secondsLeft)}</div>
          <button
            type="button"
            className="secondary-btn"
            onClick={onPause}
            disabled={isPausing}
          >
            {isPausing ? 'Pausing...' : 'Pause Test'}
          </button>
        </div>
      </header>
      {pauseError && <p className="upload-status error">{pauseError}</p>}

      <div className="test-content">
        <article className="card question-card">
          <p className="question-number">
            Question No - {sequenceQuestionNumber}
          </p>
          <h3>{currentQuestion.question}</h3>
          <div className="options">
            {currentQuestionOptions.map((option, index) => {
              const selected = answers[currentQuestion.id] === index
              return (
                <button
                  key={`${index}-${option}`}
                  type="button"
                  className={`option-btn ${selected ? 'selected' : ''}`}
                  onClick={() => onSelectAnswer(currentQuestion.id, index)}
                >
                  <span>{String.fromCharCode(65 + index)}.</span> {option}
                </button>
              )
            })}
          </div>

          <div className="actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => onToggleReview(currentQuestionId)}
            >
              {isCurrentMarkedForReview ? 'Unmark Review' : 'Mark for Review'}
            </button>
            {hasCurrentAnswer && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => onClearAnswer(currentQuestionId)}
              >
                Clear Response
              </button>
            )}
            <button
              type="button"
              className="secondary-btn"
              onClick={onPrevious}
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </button>
            {currentQuestionIndex < questions.length - 1 && (
              <button type="button" className="primary-btn" onClick={onNext}>
                Save & Next
              </button>
            )}
          </div>
        </article>

        <aside className="card panel">
          <h3>Question Palette</h3>
          <div className="palette-grid">
            {questions.map((question, index) => {
              const isCurrent = index === currentQuestionIndex
              return (
                <button
                  key={question.id}
                  type="button"
                  className={`palette-btn ${getPaletteClass(question.id)} ${isCurrent ? 'current' : ''}`}
                  onClick={() => onQuestionChange(index)}
                >
                  {index + 1}
                  {isAnsweredAndReview(question.id) && (
                    <span className="palette-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="legend">
            <p>
              <span className="dot unvisited"></span> Grey: Not Visited (No)
            </p>
            <p>
              <span className="dot visited"></span> Red: Visited but Not Answered (No)
            </p>
            <p>
              <span className="dot answered"></span> Green: Answered (Yes)
            </p>
            <p>
              <span className="dot review"></span> Violet: Marked for Review (No)
            </p>
            <p>
              <span className="dot answered-review"></span> Violet + Green ✓: Answered & Marked for Review (Yes)
            </p>
          </div>
          <button type="button" className="submit-btn full" onClick={onSubmit}>
            Submit Test
          </button>
        </aside>
      </div>
    </section>
  )
}
