import { TestNumberBadge } from './TestNumberBadge'
import { TestTitle } from './TestTitle'
import { formatDuration } from '../utils/format'

function formatTimeLeft(seconds) {
  return formatDuration(Math.max(0, Number(seconds) || 0))
}

export function PausedTestsScreen({
  pausedTests,
  isLoading,
  loadError,
  resumingPausedId,
  onResume,
  onDiscard,
  onBack,
  onRefresh,
}) {
  return (
    <section className="card paused-tests-page">
      <div className="upload-header">
        <div>
          <div className="badge">Mock Test Platform</div>
          <h2>Paused Tests</h2>
          <p className="sub-text">Resume a saved test or discard it.</p>
        </div>
        <div className="history-actions">
          <button type="button" className="secondary-btn" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button type="button" className="secondary-btn" onClick={onBack}>
            Back to Home
          </button>
        </div>
      </div>

      {loadError && <p className="upload-status error">{loadError}</p>}

      {isLoading ? (
        <p className="empty-list">Loading paused tests...</p>
      ) : pausedTests.length === 0 ? (
        <p className="empty-list">No paused tests found.</p>
      ) : (
        <ul className="paused-tests-list">
          {pausedTests.map((test) => (
            <li key={test.id} className="paused-test-item">
              <div>
                <strong>
                  <TestNumberBadge number={test.displayNumber} nickname={test.nickname} /> <TestTitle name={test.testName} />
                </strong>
                <p className="sub-text">
                  {test.answeredCount}/{test.totalQuestions} answered •{' '}
                  {formatTimeLeft(test.secondsLeft)} left • Paused{' '}
                  {new Date(test.pausedAt).toLocaleString()}
                </p>
              </div>
              <div className="paused-test-actions">
                <button
                  type="button"
                  className="primary-btn small-btn"
                  onClick={() => onResume(test.id)}
                  disabled={resumingPausedId === test.id}
                >
                  {resumingPausedId === test.id ? 'Resuming...' : 'Resume'}
                </button>
                <button
                  type="button"
                  className="secondary-btn small-btn"
                  onClick={() => onDiscard(test.id)}
                  disabled={resumingPausedId === test.id}
                >
                  Discard
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
