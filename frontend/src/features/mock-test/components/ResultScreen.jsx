import { TestNumberBadge } from './TestNumberBadge'

export function ResultScreen({ result, testNumber, testNickname, onBackToHome }) {
  return (
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
        Back to Home
      </button>
    </section>
  )
}
