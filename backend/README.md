# Backend API (Simple)

Simple Express + MongoDB backend for managing test questions and mock tests.

## Setup

1. Copy `.env.example` to `.env`
2. Set `MONGODB_URI`
3. Install and run:

```bash
npm install
npm run dev
```

## APIs

- `GET /api/health`
- `GET /api/auth/users`
- `POST /api/auth/login` (requires only `userId`; no password)
- `GET /api/questions/subjects`
- `GET /api/questions/chapters?subject=<subject>`
- `POST /api/questions/create-test` (creates a shared test in `tests`, plus a user-owned attempt in `testAttempts`)
- `GET /api/tests` (returns one entry per test in the authenticated user's history)
- `GET /api/tests/all` (returns shared tests with the authenticated user's attempt summary)
- `GET /api/tests/:testId`
- `GET /api/tests/:testId/review` (returns the authenticated user's latest completed attempt for a shared test)
- `POST /api/tests/:testId/retake` (creates a user-owned attempt in `testAttempts` and returns questions)
- `POST /api/tests/:testId/result` (stores result and answers for the authenticated user's attempt only)

New attempts retain a snapshot of their questions for review. Older attempts without a snapshot
use the current question bank and may not reflect subsequent question edits; legacy results without
saved answers cannot be reviewed.
Test lists show the latest started attempt number and the latest completed result, labeled with
its attempt number. Older results and retakes are grouped by their root test.

## Difficulty Matching

- Difficulty matching for test generation is case-insensitive and trims whitespace.
  - Canonical levels: `Easy`, `Moderate`, `Hard`
  - Alias supported for existing data: `Difficult` is treated as `Hard`
