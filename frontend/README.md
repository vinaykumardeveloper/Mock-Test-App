# Frontend - Mock Test App

Simple React frontend for a mock test application (Testbook-style layout, simplified flow).

## Current Features

- Bigger clean home screen with centered actions
- Prepare Test flow now shows available PDFs before starting test
- Separate upload page for PDFs
- Uploaded PDF list with upload time and file size
- Start test from rule-extracted PDF questions
- Test screen with:
  - Countdown timer
  - Question and options
  - Question palette (answered/current/unanswered)
  - Previous / Save & Next / Submit
- Result screen with score summary

## Folder Structure

```text
src/
  App.jsx
  main.jsx
  index.css
  features/
    mock-test/
      MockTestApp.jsx
      mockTest.css
      components/
        HomeScreen.jsx
        AvailablePdfsScreen.jsx
        TestScreen.jsx
        ResultScreen.jsx
        UploadScreen.jsx
      data/
        questions.js
      hooks/
        useCountdown.js
      utils/
        format.js
        scoring.js
```

## Run

```bash
npm install
npm run dev
```

## Backend API Connection

Create `.env` from `.env.example` and set:

```bash
VITE_API_BASE_URL=http://localhost:5000
```

Frontend uses:
- `GET /api/pdfs` to list uploaded PDFs
- `POST /api/pdfs/upload` to upload PDF files
- `GET /api/pdfs/:id/questions` to load extracted questions
