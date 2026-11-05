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
- `GET /api/questions/subjects`
- `GET /api/questions/chapters?subject=<subject>`
- `POST /api/questions/create-test` (strictly applies selected chapter filters: difficulty + question-number range, and stores generated test metadata in `tests`)
- `GET /api/tests`
- `GET /api/tests/:testId`
- `POST /api/tests/:testId/retake` (creates a new retake attempt entry in `tests` and returns its questions)

## Difficulty Matching

- Difficulty matching for test generation is case-insensitive and trims whitespace.
  - Canonical levels: `Easy`, `Moderate`, `Hard`
  - Alias supported for existing data: `Difficult` is treated as `Hard`
