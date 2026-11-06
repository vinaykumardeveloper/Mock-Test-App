import { useState } from 'react'
import { copyQuestions } from '../utils/copyQuestions'
import { TestNumberBadge } from './TestNumberBadge'

export function ResultScreen({
  result, questions, answers, testNumber, testNickname, onBackToHome, backLabel = 'Back to Home',
  reviewNotice = '',
}) {
  const [copyStatus, setCopyStatus] = useState('')
  const [copyError, setCopyError] = useState('')
  const [isCopying, setIsCopying] = useState(false)

  async function handleCopy() {
    setCopyStatus('')
    setCopyError('')
    setIsCopying(true)
    try {
      await copyQuestions(questions, navigator.clipboard)
      setCopyStatus('Questions and answers copied to clipboard.')
    } catch (error) {
      setCopyError(`Unable to copy: ${error.message || 'Please allow clipboard access and try again.'}`)
    } finally {
      setIsCopying(false)
    }
  }

  return (
    <div className="result-layout">
      <section className="card result-card">
        <div className="badge">Test Completed</div>
        <TestNumberBadge number={testNumber} nickname={testNickname} size="large" />
        <h2>
          Your Score: {result.score} / {result.maxScore}
        </h2>
        {result.incorrectMarks < 0 && (
          <p className="sub-text">
            {result.correct} correct × {result.correctMarks} − {result.incorrect} incorrect ×{' '}
            {Math.abs(result.incorrectMarks)} (negative marking)
          </p>
        )}

        <div className="result-grid">
          <div>
            <p className="result-label">Correct</p>
            <strong>{result.correct}</strong>
          </div>
          <div>
            <p className="result-label">Incorrect</p>
            <strong>{result.incorrect}</strong>
          </div>
          <div>
            <p className="result-label">Not Attempted</p>
            <strong>{result.notAnswered}</strong>
          </div>
        </div>

        <button type="button" className="primary-btn" onClick={onBackToHome}>
          {backLabel}
        </button>
      </section>
      <section className="card answer-review" aria-labelledby="answer-review-title">
        <h2 id="answer-review-title">Question Review</h2>
        {reviewNotice && <p className="sub-text">{reviewNotice}</p>}
        <p className="sub-text">
          Correct answers are shown in green. Your incorrect selections are shown in red.
        </p>
        {questions.map((question, questionIndex) => {
          const selectedOption = answers[question.id]
          const hasAnswer = Number.isInteger(selectedOption)

          return (
            <article className="review-question" key={question.id}>
              <p className="question-number">Question No - {questionIndex + 1}</p>
              <h3>{question.question}</h3>
              <p className="review-status">
                {!hasAnswer
                  ? 'Not attempted'
                  : selectedOption === question.correctOption
                    ? 'Correct'
                    : 'Incorrect'}
              </p>
              <div className="options">
                {question.options.map((option, optionIndex) => {
                  const isCorrect = optionIndex === question.correctOption
                  const isSelected = optionIndex === selectedOption
                  const optionClass = isCorrect ? 'correct' : isSelected ? 'incorrect' : ''

                  return (
                    <div className={`review-option ${optionClass}`} key={`${optionIndex}-${option}`}>
                      <span>{String.fromCharCode(65 + optionIndex)}. {option}</span>
                      {(isCorrect || isSelected) && (
                        <span className="review-option-label">
                          {isCorrect ? 'Correct answer' : 'Your answer'}
                          {isCorrect && isSelected ? ' · Your answer' : ''}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </article>
          )
        })}
        <div className="review-actions">
          <button type="button" className="primary-btn" onClick={handleCopy} disabled={isCopying}>
            {isCopying ? 'Copying...' : 'Copy Questions and Answers'}
          </button>
          <button type="button" className="secondary-btn" onClick={onBackToHome}>
            {backLabel}
          </button>
        </div>
        {copyStatus && <p className="upload-status success" role="status">{copyStatus}</p>}
        {copyError && <p className="upload-status error" role="alert">{copyError}</p>}
      </section>
    </div>
  )
}
