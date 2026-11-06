function attemptNumber(row) {
  const number = Number(row.attemptNumber)
  return Number.isInteger(number) && number > 0 ? number : 1
}

function timestamp(value) {
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function summarizeAttempts(rows) {
  const groups = new Map()
  for (const row of rows) {
    const rootId = row.rootTestId || row.libraryTestId || row.testId
    if (!rootId) continue
    const group = groups.get(rootId) || { latest: null, completed: null, number: 0 }
    const started = timestamp(row.createdAt || row.startedAt)
    const latestStarted = group.latest && timestamp(group.latest.createdAt || group.latest.startedAt)
    if (!group.latest || started > latestStarted ||
      (started === latestStarted && attemptNumber(row) > attemptNumber(group.latest))) {
      group.latest = row
    }
    group.number = Math.max(group.number, attemptNumber(row))
    if (row.result) {
      const completed = timestamp(row.result.submittedAt || row.createdAt || row.startedAt)
      const previous = group.completed
      const previousTime = previous && timestamp(previous.result.submittedAt || previous.createdAt || previous.startedAt)
      if (!previous || completed > previousTime ||
        (completed === previousTime && attemptNumber(row) > attemptNumber(previous))) {
        group.completed = row
      }
    }
    groups.set(rootId, group)
  }

  return [...groups.entries()].map(([rootTestId, group]) => ({
    ...group.latest,
    rootTestId,
    userAttemptNumber: group.number,
    result: group.completed?.result || null,
    resultAttemptNumber: group.completed ? attemptNumber(group.completed) : null,
    resultTestId: group.completed?.testId || null,
  }))
}

module.exports = { summarizeAttempts }
