import { useState } from 'react'
import { TestNumberBadge } from './TestNumberBadge'
import { TestTitle } from './TestTitle'

const TESTS_PER_PAGE = 3

function formatDateTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleString()
}

function getFilterSummary(filters) {
  if (!filters || typeof filters !== 'object') {
    return 'N/A'
  }

  const subject = Array.isArray(filters.subjects) ? filters.subjects.filter(Boolean).join(', ') : ''
  const chapters = Array.isArray(filters.chapters) ? filters.chapters.filter(Boolean).join(', ') : ''
  const difficulties = Array.isArray(filters.difficulty)
    ? filters.difficulty.filter(Boolean).join(', ')
    : ''
  const rangeFrom = filters.questionNumberRange?.from
  const rangeTo = filters.questionNumberRange?.to
  const range =
    Number.isInteger(rangeFrom) || Number.isInteger(rangeTo)
      ? `${rangeFrom ?? '-'} to ${rangeTo ?? '-'}`
      : ''

  const parts = [
    { value: subject, className: 'previous-test-subject' },
    { value: chapters, className: 'previous-test-chapters' },
    { value: difficulties },
    { value: range && `Q.No. ${range}` },
  ].filter((part) => part.value)

  return parts.length > 0 ? (
    <>
      {parts.map((part, index) => (
        <span key={part.value} className={part.className}>
          {index > 0 && ' • '}
          {part.value}
        </span>
      ))}
    </>
  ) : (
    'N/A'
  )
}

export function PreviousTestsScreen({
  previousTests,
  isLoading,
  loadError,
  selectedTestId,
  selectedTest,
  isLoadingSelectedTest,
  selectedTestError,
  onOpenTest,
  onRetakeTest,
  onReviewTest,
  onCloseTest,
  isRetakingTest,
  isReviewingTest = false,
  onBack,
  onRefresh,
  title = 'Previous Tests',
  badge = 'History',
  showOwner = false,
  readOnly = false,
  testActionLabel = 'Retake Test',
  emptyText = 'No saved tests found yet.',
  loadingText = 'Loading previous tests...',
}) {
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(previousTests.length / TESTS_PER_PAGE))
  const currentPage = Math.min(page, totalPages - 1)
  const visibleTests = previousTests.slice(
    currentPage * TESTS_PER_PAGE,
    (currentPage + 1) * TESTS_PER_PAGE,
  )
  const pageOffset = currentPage * TESTS_PER_PAGE

  function getDisplayTestNumber(test, index) {
    if (test?.displayNumber) {
      return test.displayNumber
    }
    return String(index + 1)
  }

  const selectedTestSequence =
    selectedTestId && Array.isArray(previousTests)
      ? previousTests.findIndex((test) => test.testId === selectedTestId) + 1
      : -1
  const selectedTestDisplayNumber = selectedTest
    ? selectedTest.displayNumber ||
      (selectedTestSequence > 0 ? getDisplayTestNumber(selectedTest, selectedTestSequence - 1) : '-')
    : '-'

  return (
    <section className="card previous-tests-page">
      <div className="upload-header">
        <div>
          <div className="badge">{badge}</div>
          <h2>{title}</h2>
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
        <p className="empty-list">{loadingText}</p>
      ) : previousTests.length === 0 ? (
        <p className="empty-list">{emptyText}</p>
      ) : (
        <ul className="previous-tests-list">
          {visibleTests.map((test, index) => (
            <li key={test.testId} className="previous-test-item">
              <div>
                <h3>
                  <TestNumberBadge number={getDisplayTestNumber(test, pageOffset + index)} nickname={test.nickname} size="large" />{' '}
                  <TestTitle name={test.testName} />
                </h3>
                <p className="sub-text">
                  {showOwner && test.owner ? `Created by ${test.owner} • ` : ''}
                  Test Date: {formatDateTime(test.createdAt)}
                </p>
                <p className="sub-text">Attempt number - {test.userAttemptNumber ?? 0}</p>
                {test.result && (
                  <p className="sub-text">
                    Result - Attempt {test.resultAttemptNumber}: {test.result.score} / {test.result.maxScore}
                  </p>
                )}
              </div>
              <div className="previous-test-meta">
                <button
                  type="button"
                  className="secondary-btn small-btn"
                  onClick={() => onOpenTest(test.testId)}
                  disabled={isLoadingSelectedTest && selectedTestId === test.testId}
                >
                  {isLoadingSelectedTest && selectedTestId === test.testId
                    ? 'Opening...'
                    : 'Open Test'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && previousTests.length > TESTS_PER_PAGE && (
        <div className="previous-tests-pager">
          <button
            type="button"
            className="pager-btn"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 0}
            aria-label="Previous tests"
            title="Previous"
          >
            ‹
          </button>
          <span className="pager-info">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            type="button"
            className="pager-btn"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            aria-label="Next tests"
            title="Next"
          >
            ›
          </button>
        </div>
      )}

      {selectedTestError &&   <p className="upload-status error">{selectedTestError}</p>}

      {selectedTest && (
        <section className="previous-test-details card">
          <button
            type="button"
            className="details-close-btn"
            onClick={onCloseTest}
            aria-label="Close test details"
            title="Close"
          >
            ×
          </button>
          <h3>
            <TestNumberBadge number={selectedTestDisplayNumber} nickname={selectedTest.nickname} size="large" />{' '}
            {selectedTest.testName ? <TestTitle name={selectedTest.testName} /> : 'Test Details'}
          </h3>
          <p className="sub-text">
            {showOwner && selectedTest.owner ? `Created by ${selectedTest.owner} • ` : ''}
            Created: {formatDateTime(selectedTest.createdAt)}
          </p>
          <p className="sub-text">Attempt number - {selectedTest.userAttemptNumber ?? 0}</p>
          {!readOnly && (
            <div className="previous-test-details-actions">
              <button
                type="button"
                className="primary-btn"
                onClick={() => onRetakeTest(selectedTest.testId)}
                disabled={isRetakingTest || isReviewingTest}
              >
                {isRetakingTest ? 'Starting Test...' : testActionLabel}
              </button>
              {onReviewTest && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => onReviewTest(selectedTest.testId)}
                  disabled={isRetakingTest || isReviewingTest}
                >
                  {isReviewingTest ? 'Loading Review...' : 'Review Test'}
                </button>
              )}
              {onReviewTest && (
                <p className="sub-text">Review shows your latest completed attempt.</p>
              )}
            </div>
          )}
          <div className="previous-test-details-grid">
            <div>
              <p className="result-label">Total Questions</p>
              <strong>{selectedTest.totalQuestions}</strong>
            </div>
            <div>
              <p className="result-label">Duration</p>
              <strong>{selectedTest.durationMinutes} mins</strong>
            </div>
            <div>
              <p className="result-label">Marking</p>
              <strong>
                +{selectedTest.markingScheme?.correct ?? 1} /{' '}
                {selectedTest.markingScheme?.incorrect ?? 0}
              </strong>
            </div>
          </div>
          <p className="sub-text">
            Filters: {getFilterSummary(selectedTest.filters)}
          </p>
          <h4>
            Result{selectedTest.resultAttemptNumber ? ` - Attempt ${selectedTest.resultAttemptNumber}` : ''}
          </h4>
          {selectedTest.result ? (
            <>
              <div className="previous-test-details-grid">
                <div>
                  <p className="result-label">Score</p>
                  <strong>
                    {selectedTest.result.score} / {selectedTest.result.maxScore}
                  </strong>
                </div>
                <div>
                  <p className="result-label">Correct</p>
                  <strong>{selectedTest.result.correct}</strong>
                </div>
                <div>
                  <p className="result-label">Incorrect</p>
                  <strong>{selectedTest.result.incorrect}</strong>
                </div>
                <div>
                  <p className="result-label">Not Attempted</p>
                  <strong>{selectedTest.result.notAnswered}</strong>
                </div>
              </div>
              <p className="sub-text">
                Submitted: {formatDateTime(selectedTest.result.submittedAt)}
              </p>
            </>
          ) : (
            <p className="sub-text">No result yet. This test has not been submitted.</p>
          )}
        </section>
      )}
    </section>
  )
}
