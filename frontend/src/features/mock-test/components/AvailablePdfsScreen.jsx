export function AvailablePdfsScreen({
  subjects,
  chapters,
  selectedSubject,
  selectedChapters,
  chapterConfigs,
  testNickname,
  negativeMarks,
  onNegativeMarksChange,  totalQuestions,
  testTimeMinutes,
  isLoadingSubjects,
  isLoadingChapters,
  isCreatingTest,
  createProgress,
  prepareTestError,
  onBack,
  onSubjectChange,
  onChapterToggle,
  onChapterDifficultyToggle,
  onChapterRangeChange,
  onTestNicknameChange,
  onTotalQuestionsChange,
  onTestTimeChange,
  onCreateTest,
}) {
  const difficultyLevels = ['Easy', 'Moderate', 'Hard']
  const canStart =
    selectedChapters.length > 0 &&
    Number(totalQuestions) > 0 &&
    Number(testTimeMinutes) > 0 &&
    !isCreatingTest

  return (
    <section className="card available-pdfs-page">
      <div className="upload-header">
        <div>
          <div className="badge">Create Test</div>
          <h2>Create Custom Test</h2>
          <p className="sub-text">
            Choose subject, chapters, total questions and test time.
          </p>
        </div>
        <button type="button" className="secondary-btn" onClick={onBack}>
          Back to Home
        </button>
      </div>

      {prepareTestError && <p className="upload-status error">{prepareTestError}</p>}

      <div className="pdf-selection-panel">
        {isCreatingTest && (
          <div className="create-progress-wrap" role="status" aria-live="polite">
            <div className="create-progress-label">
              Creating test... {Math.max(0, Math.min(100, Math.trunc(createProgress)))}%
            </div>
            <div className="create-progress-track" aria-hidden="true">
              <div
                className="create-progress-fill"
                style={{
                  width: `${Math.max(0, Math.min(100, Math.trunc(createProgress)))}%`,
                }}
              />
            </div>
          </div>
        )}

        <label htmlFor="test-nickname" className="question-count-label">
          Test Nickname (optional)
        </label>
        <input
          id="test-nickname"
          type="text"
          maxLength={40}
          placeholder="e.g. Weekend practice"
          value={testNickname}
          onChange={(event) => onTestNicknameChange(event.target.value)}
          disabled={isCreatingTest}
        />

        <label htmlFor="subject-select" className="question-count-label">
          Subject
        </label>
        <select
          id="subject-select"
          value={selectedSubject}
          onChange={(event) => onSubjectChange(event.target.value)}
          disabled={isLoadingSubjects || isCreatingTest}
        >
          <option value="">Select subject</option>
          {subjects.map((subject) => (
            <option key={subject.subject} value={subject.subject}>
              {subject.subject} ({subject.questionCount})
            </option>
          ))}
        </select>

        <div>
          <p className="question-count-label">Chapters</p>
          {isLoadingChapters ? (
            <p className="empty-list">Loading chapters...</p>
          ) : chapters.length === 0 ? (
            <p className="empty-list">
              {selectedSubject
                ? 'No chapters found for selected subject.'
                : 'Select a subject to view chapters.'}
            </p>
          ) : (
            <div className="chapter-grid">
              {selectedChapters.length > 0 && (
                <p className="sub-text">
                  Selected: {selectedChapters.map((key) => key.replace('||', ' – ')).join(', ')}
                </p>
              )}
              {chapters.map((chapter) => {
                const chapterKey = `${selectedSubject}||${chapter.chapter}`
                const isChecked = selectedChapters.includes(chapterKey)
                const config = chapterConfigs[chapterKey] || {
                  difficulties: [...difficultyLevels],
                  startQuestionNumber: '',
                  endQuestionNumber: '',
                }
                return (
                  <div key={chapter.chapter} className="chapter-item-wrap">
                    <label className="chapter-item">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(event) =>
                          onChapterToggle(chapterKey, event.target.checked)
                        }
                        disabled={isCreatingTest}
                      />
                      <span>
                        {chapter.chapter} ({chapter.questionCount})
                      </span>
                    </label>

                    <div className={`chapter-config${isChecked ? '' : ' disabled'}`}>
                        <div className="chapter-difficulties">
                          {difficultyLevels.map((difficulty) => (
                            <label key={`${chapter.chapter}-${difficulty}`} className="chapter-item">
                              <input
                                type="checkbox"
                                checked={config.difficulties.includes(difficulty)}
                                onChange={(event) =>
                                  onChapterDifficultyToggle(
                                    chapterKey,
                                    difficulty,
                                    event.target.checked,
                                  )
                                }
                                disabled={isCreatingTest || !isChecked}
                              />
                              <span>{difficulty}</span>
                            </label>
                          ))}
                        </div>
                        <div className="chapter-range">
                          <label>
                            Q. No. From
                            <input
                              type="number"
                              min={1}
                              value={config.startQuestionNumber}
                              onChange={(event) =>
                                onChapterRangeChange(
                                  chapterKey,
                                  'startQuestionNumber',
                                  event.target.value,
                                )
                              }
                              disabled={isCreatingTest || !isChecked}
                            />
                          </label>
                          <label>
                            To
                            <input
                              type="number"
                              min={1}
                              value={config.endQuestionNumber}
                              onChange={(event) =>
                                onChapterRangeChange(
                                  chapterKey,
                                  'endQuestionNumber',
                                  event.target.value,
                                )
                              }
                              disabled={isCreatingTest || !isChecked}
                            />
                          </label>
                        </div>
                      </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <label htmlFor="total-questions" className="question-count-label">
          Total Test Questions
        </label>
        <input
          id="total-questions"
          type="number"
          min={1}
          value={totalQuestions}
          onChange={(event) => onTotalQuestionsChange(event.target.value)}
          disabled={isCreatingTest}
        />

        <label htmlFor="test-time" className="question-count-label">
          Test Time (minutes)
        </label>
        <select
          id="test-time"
          value={String(testTimeMinutes)}
          onChange={(event) => onTestTimeChange(event.target.value)}
          disabled={isCreatingTest}
        >
          {[15, 30, 45, 60, 90, 120].map((minutes) => (
            <option key={minutes} value={String(minutes)}>
              {minutes}
            </option>
          ))}
        </select>

        <label htmlFor="negative-marks" className="question-count-label">
          Negative Marks per wrong answer (0 for none)
        </label>
        <input
          id="negative-marks"
          type="number"
          min={0}
          max={10}
          step="0.25"
          placeholder="e.g. 0.25"
          value={negativeMarks}
          onChange={(event) => onNegativeMarksChange(event.target.value)}
          disabled={isCreatingTest}
        />

        <button
          type="button"
          className="primary-btn"
          disabled={!canStart}
          onClick={onCreateTest}
        >
          {isCreatingTest ? 'Creating Test...' : 'Start Test'}
        </button>
      </div>
    </section>
  )
}
