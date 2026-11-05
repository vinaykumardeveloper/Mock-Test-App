const Counter = require('../models/Counter')
const Test = require('../models/Test')

// Atomic per-user counter; seeded from existing numbers so it never reuses one.
async function nextTestNumber(owner) {
  const key = `testNumber:${owner}`
  const existing = await Counter.findById(key).lean()
  if (!existing) {
    const latest = await Test.findOne({ owner }).sort({ testNumber: -1 }).select('testNumber').lean()
    await Counter.updateOne(
      { _id: key },
      { $setOnInsert: { seq: Number(latest?.testNumber) || 0 } },
      { upsert: true },
    ).catch(() => {})
  }

  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  )
  return counter.seq
}

// Retakes reuse the original test's number and add the attempt: "3-2".
function getDisplayNumber(test, rootNumber) {
  const rootValue = Number(rootNumber)
  const number = Number.isInteger(rootValue) && rootValue > 0 ? rootValue : Number(test?.testNumber)
  if (!Number.isInteger(number) || number <= 0) {
    return null
  }
  const attempt = Number(test?.attemptNumber)
  return Number.isInteger(attempt) && attempt > 1 ? `${number}-${attempt}` : String(number)
}

// Maps rootTestId -> the original test's number for the given tests.
async function getRootNumbers(owner, tests) {
  const rootIds = [
    ...new Set(tests.map((test) => test.rootTestId || test.testId).filter(Boolean)),
  ]
  const roots = await Test.find(owner ? { owner, testId: { $in: rootIds } } : { testId: { $in: rootIds } })
    .select('testId testNumber')
    .lean()
  return new Map(roots.map((root) => [root.testId, root.testNumber]))
}

const backfillInFlight = new Map()

async function runBackfill(owner) {
  const tests = await Test.find({ owner })
    .sort({ createdAt: 1 })
    .select('testId testNumber attemptNumber')
    .lean()

  // Every original test needs its own number: un-numbered ones and later duplicates get a fresh one.
  // Retakes share their original's number, so they never get one.
  const used = new Set()
  for (const test of tests) {
    if (Number(test.attemptNumber) > 1) {
      continue
    }
    const number = Number(test.testNumber)
    if (Number.isInteger(number) && number > 0 && !used.has(number)) {
      used.add(number)
      continue
    }
    const fresh = await nextTestNumber(owner)
    used.add(fresh)
    await Test.updateOne({ owner, testId: test.testId }, { $set: { testNumber: fresh } })
  }
}

// Gives older, un-numbered tests a number (oldest first) so every test has one.
function backfillTestNumbers(owner) {
  if (!backfillInFlight.has(owner)) {
    const job = runBackfill(owner).finally(() => backfillInFlight.delete(owner))
    backfillInFlight.set(owner, job)
  }
  return backfillInFlight.get(owner)
}

module.exports = { nextTestNumber, getDisplayNumber, getRootNumbers, backfillTestNumbers }
