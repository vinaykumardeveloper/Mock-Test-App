import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { HomeScreen } from './components/HomeScreen'
import { ResultScreen } from './components/ResultScreen'
import { TestScreen } from './components/TestScreen'
import { AvailablePdfsScreen } from './components/AvailablePdfsScreen'
import { PreviousTestsScreen } from './components/PreviousTestsScreen'
import { PausedTestsScreen } from './components/PausedTestsScreen'
import { UserSelectScreen } from './components/UserSelectScreen'
import { LoginScreen } from './components/LoginScreen'
import { TEST_DURATION_SECONDS } from './data/questions'
import {
  DEFAULT_TEST_LABEL,
  activeTestActions,
  activeTestReducer,
  initialActiveTest,
} from './activeTestReducer'
import { useCountdown } from './hooks/useCountdown'
import { getScoreSummary } from './utils/scoring'
import './mockTest.css'

const screenState = {
  userSelect: 'userSelect',
  login: 'login',
  home: 'home',
  prepareTest: 'prepareTest',
  previousTests: 'previousTests',
  allTests: 'allTests',
  testReview: 'testReview',
  pausedTests: 'pausedTests',
  test: 'test',
  result: 'result',
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
).replace(/\/+$/, '')
const DIFFICULTY_LEVELS = ['Easy', 'Moderate', 'Hard']
const USERS = [
  { id: 'H', name: 'H' },
  { id: 'V', name: 'V' },
]

function getReadableError(error, fallbackMessage) {
  if (error instanceof TypeError) {
    return 'Cannot reach backend API. Check backend server, Atlas whitelist, and CORS.'
  }

  return error.message || fallbackMessage
}

function isGeneralAwarenessSubject(subject) {
  const normalized = String(subject || '')
    .toLowerCase()
    .replace(/\s+/g, '')
  return normalized === 'generalawareness' || normalized === 'generalawarness'
}

async function parseJsonResponse(response) {
  const rawBody = await response.text()
  if (!rawBody) {
    return null
  }

  try {
    return JSON.parse(rawBody)
  } catch {
    throw new Error('Server returned an invalid response. Please try again.')
  }
}

export function MockTestApp() {
  const [screen, setScreen] = useState(screenState.userSelect)
  const [authToken, setAuthToken] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [loginUser, setLoginUser] = useState(null)
  const [loginError, setLoginError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [activeTest, dispatch] = useReducer(activeTestReducer, initialActiveTest)
  const {
    questions: activeQuestions,
    testId: activeTestId,
    label: activeTestLabel,
    number: activeTestNumber,
    nickname: activeTestNickname,
    markingScheme: activeMarkingScheme,
    durationSeconds: testDurationSeconds,
    answers,
    visited: visitedQuestionIds,
    review: reviewQuestionIds,
    currentIndex: currentQuestionIndex,
  } = activeTest

  const [subjects, setSubjects] = useState([])
  const [chapters, setChapters] = useState([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedChapters, setSelectedChapters] = useState([])
  const [chapterConfigs, setChapterConfigs] = useState({})
  const [topicsByChapter, setTopicsByChapter] = useState({})
  const [loadingTopicsByChapter, setLoadingTopicsByChapter] = useState({})
  const [testNickname, setTestNickname] = useState('')
  const [negativeMarks, setNegativeMarks] = useState('0')
  const [totalQuestions, setTotalQuestions] = useState('30')
  const [testTimeMinutes, setTestTimeMinutes] = useState('30')
  const [prepareTestError, setPrepareTestError] = useState('')
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false)
  const [isLoadingChapters, setIsLoadingChapters] = useState(false)
  const [isCreatingTest, setIsCreatingTest] = useState(false)
  const [createProgress, setCreateProgress] = useState(0)
  const [previousTests, setPreviousTests] = useState([])
  const [isLoadingPreviousTests, setIsLoadingPreviousTests] = useState(false)
  const [previousTestsError, setPreviousTestsError] = useState('')
  const [allTests, setAllTests] = useState([])
  const [isLoadingAllTests, setIsLoadingAllTests] = useState(false)
  const [allTestsError, setAllTestsError] = useState('')
  const [selectedPreviousTestId, setSelectedPreviousTestId] = useState('')
  const [selectedPreviousTest, setSelectedPreviousTest] = useState(null)
  const [isLoadingSelectedPreviousTest, setIsLoadingSelectedPreviousTest] = useState(false)
  const [selectedPreviousTestError, setSelectedPreviousTestError] = useState('')
  const [isRetakingPreviousTest, setIsRetakingPreviousTest] = useState(false)
  const [isReviewingTest, setIsReviewingTest] = useState(false)
  const [savedTestReview, setSavedTestReview] = useState(null)
  const [pausedTests, setPausedTests] = useState([])
  const [pausedTestsError, setPausedTestsError] = useState('')
  const [isLoadingPausedTests, setIsLoadingPausedTests] = useState(false)
  const [resumingPausedId, setResumingPausedId] = useState('')
  const [isPausing, setIsPausing] = useState(false)
  const [pauseError, setPauseError] = useState('')
  const pausedIdRef = useRef(null)
  const authTokenRef = useRef('')
  const latestResultRef = useRef({ testId: '', summary: null })
  const latestAnswersRef = useRef({})
  const attemptStartedAtRef = useRef('')
  const historyInitializedRef = useRef(false)
  const chaptersRequestRef = useRef(0)

  const navigateToScreen = useCallback((nextScreen, replace = false) => {
    const historyState = { mockTestApp: true, screen: nextScreen }
    if (replace) {
      window.history.replaceState(historyState, '')
    } else {
      window.history.pushState(historyState, '')
    }
    setScreen(nextScreen)
  }, [])

  const submitTest = useCallback(() => {
    const pausedId = pausedIdRef.current
    pausedIdRef.current = null
    const authHeaders = { Authorization: 'Bearer ' + authTokenRef.current }
    const { testId, summary } = latestResultRef.current
    if (testId && summary) {
      void fetch(`${API_BASE_URL}/api/tests/${encodeURIComponent(testId)}/result`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...summary,
          answers: latestAnswersRef.current,
          startedAt: attemptStartedAtRef.current || new Date().toISOString(),
          completionStatus: 'completed',
        }),
      }).catch(() => {})
    }
    if (pausedId) {
      // The attempt is finished, so its saved progress is no longer needed.
      void fetch(`${API_BASE_URL}/api/paused-tests/${pausedId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authTokenRef.current}` },
      }).catch(() => {})
    }
    navigateToScreen(screenState.result, true)
  }, [navigateToScreen])

  useEffect(() => {
    if (!historyInitializedRef.current) {
      historyInitializedRef.current = true
      window.history.replaceState(
        { mockTestApp: true, screen: screenState.userSelect, boundary: true },
        '',
      )
      window.history.pushState(
        { mockTestApp: true, screen: screenState.userSelect },
        '',
      )
    }

    function handlePopState(event) {
      const historyState = event.state
      const validScreen =
        historyState?.mockTestApp && Object.values(screenState).includes(historyState.screen)
      const unauthenticatedScreen =
        historyState?.screen === screenState.userSelect || historyState?.screen === screenState.login
      if (!validScreen || (!authTokenRef.current && !unauthenticatedScreen)) {
        navigateToScreen(screenState.userSelect, true)
        return
      }

      setScreen(historyState.screen)
      if (historyState.boundary) {
        window.history.pushState(
          { mockTestApp: true, screen: historyState.screen },
          '',
        )
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [navigateToScreen])

  const { secondsLeft, reset } = useCountdown(
    testDurationSeconds,
    screen === screenState.test,
    submitTest,
  )

  const result = useMemo(
    () => getScoreSummary(activeQuestions, answers, activeMarkingScheme),
    [activeQuestions, answers, activeMarkingScheme],
  )

  useEffect(() => {
    latestResultRef.current = { testId: activeTestId, summary: result }
  }, [activeTestId, result])

  useEffect(() => {
    latestAnswersRef.current = answers
  }, [answers])

  useEffect(() => {
    if (!isCreatingTest) {
      setCreateProgress(0)
      return
    }

    setCreateProgress(12)
    const progressTimer = setInterval(() => {
      setCreateProgress((prev) => {
        if (prev >= 92) {
          return prev
        }
        return Math.min(92, prev + Math.max(1, Math.floor((100 - prev) / 10)))
      })
    }, 300)

    return () => {
      clearInterval(progressTimer)
    }
  }, [isCreatingTest])

  function startTest(
    customQuestions = initialActiveTest.questions,
    label = DEFAULT_TEST_LABEL,
    durationSeconds = TEST_DURATION_SECONDS,
    testNumber = '',
    testId = '',
    nickname = '',
    markingScheme = null,
    startedAt = null,
  ) {
    if (!Array.isArray(customQuestions) || customQuestions.length === 0) {
      setPrepareTestError('No questions available to start the test.')
      return
    }

    const parsedDuration = Number(durationSeconds)
    const finalDuration =
      Number.isFinite(parsedDuration) && parsedDuration > 0
        ? Math.trunc(parsedDuration)
        : TEST_DURATION_SECONDS

    dispatch({
      type: activeTestActions.start,
      payload: {
        questions: customQuestions,
        label,
        number: testNumber,
        testId,
        nickname,
        markingScheme,
        durationSeconds: finalDuration,
      },
    })
    reset(finalDuration)
    pausedIdRef.current = null
    const parsedStartedAt = new Date(startedAt || Date.now())
    attemptStartedAtRef.current = Number.isNaN(parsedStartedAt.getTime())
      ? new Date().toISOString()
      : parsedStartedAt.toISOString()
    setPauseError('')
    navigateToScreen(screenState.test, true)
  }

  function selectAnswer(questionId, optionIndex) {
    dispatch({ type: activeTestActions.setAnswer, payload: { questionId, optionIndex } })
  }

  function clearAnswer(questionId) {
    dispatch({ type: activeTestActions.clearAnswer, payload: { questionId } })
  }

  function toggleMarkForReview(questionId) {
    dispatch({ type: activeTestActions.toggleReview, payload: { questionId } })
  }

  function goToQuestion(index) {
    dispatch({ type: activeTestActions.goToQuestion, payload: { index } })
  }

  function moveToPreviousQuestion() {
    goToQuestion(currentQuestionIndex - 1)
  }

  function moveToNextQuestion() {
    goToQuestion(currentQuestionIndex + 1)
  }

  function backToHome() {
    navigateToScreen(screenState.home, true)
    dispatch({ type: activeTestActions.reset })
    reset(TEST_DURATION_SECONDS)
    setPrepareTestError('')
  }

  function resetSessionState() {
    dispatch({ type: activeTestActions.reset })
    reset(TEST_DURATION_SECONDS)
    setPrepareTestError('')
    setSubjects([])
    setChapters([])
    setSelectedSubject('')
    setSelectedChapters([])
    setChapterConfigs({})
    setPreviousTests([])
    setPreviousTestsError('')
    setAllTests([])
    setAllTestsError('')
    setSelectedPreviousTestId('')
    setSelectedPreviousTest(null)
    setSelectedPreviousTestError('')
    setSavedTestReview(null)
    attemptStartedAtRef.current = ''
  }

  function logout() {
    authTokenRef.current = ''
    pausedIdRef.current = null
    setAuthToken('')
    setCurrentUser(null)
    setLoginUser(null)
    setLoginError('')
    setPausedTests([])
    setPausedTestsError('')
    attemptStartedAtRef.current = ''
    resetSessionState()
    navigateToScreen(screenState.userSelect, true)
  }

  async function loadPausedTests(token = authTokenRef.current) {
    setIsLoadingPausedTests(true)
    setPausedTestsError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/paused-tests`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to load paused tests.')
      }
      setPausedTests(Array.isArray(payload.data) ? payload.data : [])
      setPausedTestsError('')
    } catch (error) {
      setPausedTestsError(getReadableError(error, 'Unable to load paused tests.'))
    } finally {
      setIsLoadingPausedTests(false)
    }
  }

  async function pauseTest() {
    setIsPausing(true)
    setPauseError('')
    try {
      const existingId = pausedIdRef.current
      const response = await apiFetch(
        `${API_BASE_URL}/api/paused-tests${existingId ? `/${existingId}` : ''}`,
        {
          method: existingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            testId: activeTestId,
            testName: activeTestLabel,
            nickname: activeTestNickname,
            markingScheme: activeMarkingScheme,
            displayNumber: activeTestNumber,
            durationSeconds: testDurationSeconds,
            secondsLeft,
            currentQuestionIndex,
            questions: activeQuestions,
            answers,
            visitedQuestionIds,
            reviewQuestionIds,
            startedAt: attemptStartedAtRef.current || new Date().toISOString(),
          }),
        },
      )
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to pause the test.')
      }

      pausedIdRef.current = null
      await loadPausedTests()
      backToHome()
    } catch (error) {
      setPauseError(getReadableError(error, 'Unable to pause the test.'))
    } finally {
      setIsPausing(false)
    }
  }

  async function resumePausedTest(id) {
    setResumingPausedId(id)
    setPausedTestsError('')
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/paused-tests/${id}`)
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to resume the test.')
      }

      const saved = payload.data
      dispatch({ type: activeTestActions.resume, payload: saved })
      reset(saved.secondsLeft)
      const resumedStartedAt = new Date(saved?.startedAt || Date.now())
      attemptStartedAtRef.current = Number.isNaN(resumedStartedAt.getTime())
        ? new Date().toISOString()
        : resumedStartedAt.toISOString()
      pausedIdRef.current = id
      setPauseError('')
      navigateToScreen(screenState.test)
    } catch (error) {
      setPausedTestsError(getReadableError(error, 'Unable to resume the test.'))
    } finally {
      setResumingPausedId('')
    }
  }

  async function discardPausedTest(id) {
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/paused-tests/${id}`, {
        method: 'DELETE',
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to discard the paused test.')
      }
      setPausedTests((prev) => prev.filter((item) => item.id !== id))
    } catch (error) {
      setPausedTestsError(getReadableError(error, 'Unable to discard the paused test.'))
    }
  }

  function apiFetch(url, options = {}) {
    return fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${authToken}` },
    }).then((response) => {
      if (response.status === 401) {
        logout()
      }
      return response
    })
  }

  function chooseUser(user) {
    setLoginUser(user)
    setLoginError('')
    navigateToScreen(screenState.login)
  }

  function cancelLogin() {
    setLoginUser(null)
    setLoginError('')
    navigateToScreen(screenState.userSelect, true)
  }

  async function submitLogin() {
    if (!loginUser) {
      return
    }
    setIsLoggingIn(true)
    setLoginError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: loginUser.id }),
      })
      const payload = await parseJsonResponse(response)

      if (!payload) {
        throw new Error('Server returned an empty response. Please try again.')
      }

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Login failed.')
      }

      authTokenRef.current = payload.data.token
      setAuthToken(payload.data.token)
      setCurrentUser(payload.data.user)
      void loadPausedTests(payload.data.token)
      navigateToScreen(screenState.home, true)
    } catch (error) {
      setLoginError(getReadableError(error, 'Login failed.'))
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function loadSubjects() {
    setIsLoadingSubjects(true)
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/questions/subjects`)
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to fetch subjects.')
      }

      const rows = Array.isArray(payload.data) ? payload.data : []
      setSubjects(rows)
      setPrepareTestError('')
    } catch (error) {
      setPrepareTestError(getReadableError(error, 'Unable to load subjects.'))
    } finally {
      setIsLoadingSubjects(false)
    }
  }

  async function loadChapters(subject) {
    const requestId = ++chaptersRequestRef.current
    if (!subject) {
      setChapters([])
      setIsLoadingChapters(false)
      return
    }

    setIsLoadingChapters(true)
    setChapters([])
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/api/questions/chapters?subject=${encodeURIComponent(subject)}`,
      )
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to fetch chapters.')
      }

      if (requestId !== chaptersRequestRef.current) {
        return
      }
      const rows = Array.isArray(payload.data) ? payload.data : []
      setChapters(rows)
      setChapterConfigs((prev) => {
        const nextConfigs = { ...prev }
        for (const row of rows) {
          const key = `${subject}||${row.chapter}`
          if (!nextConfigs[key]) {
            nextConfigs[key] = {
              difficulties: [...DIFFICULTY_LEVELS],
              topics: [],
              startQuestionNumber: '',
              endQuestionNumber: '',
            }
          }
        }
        return nextConfigs
      })
      setPrepareTestError('')
    } catch (error) {
      if (requestId === chaptersRequestRef.current) {
        setPrepareTestError(getReadableError(error, 'Unable to load chapters.'))
        setChapters([])
      }
    } finally {
      if (requestId === chaptersRequestRef.current) {
        setIsLoadingChapters(false)
      }
    }
  }

  async function loadTopics(subject, chapter) {
    const chapterKey = `${subject}||${chapter}`
    setLoadingTopicsByChapter((prev) => ({ ...prev, [chapterKey]: true }))
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/api/questions/topics?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}`,
      )
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to fetch topics.')
      }
      const rows = Array.isArray(payload.data) ? payload.data : []
      const topics = rows
        .map((row) => String(row?.topic || '').trim())
        .filter(Boolean)
      setTopicsByChapter((prev) => ({ ...prev, [chapterKey]: rows }))
      setChapterConfigs((prev) => {
        const current = prev[chapterKey] || {
          difficulties: [...DIFFICULTY_LEVELS],
          topics: [],
          startQuestionNumber: '',
          endQuestionNumber: '',
        }
        const existingTopics = Array.isArray(current.topics)
          ? current.topics.filter((topic) => topics.includes(topic))
          : []
        const nextTopics = existingTopics.length > 0 ? existingTopics : topics
        return {
          ...prev,
          [chapterKey]: {
            ...current,
            topics: nextTopics,
          },
        }
      })
    } catch (error) {
      setTopicsByChapter((prev) => ({ ...prev, [chapterKey]: [] }))
      setPrepareTestError(getReadableError(error, 'Unable to load topics.'))
    } finally {
      setLoadingTopicsByChapter((prev) => ({ ...prev, [chapterKey]: false }))
    }
  }

  function openPrepareTestPage() {
    void loadSubjects()
    chaptersRequestRef.current += 1
    setIsLoadingChapters(false)
    setPrepareTestError('')
    setSelectedSubject('')
    setSelectedChapters([])
    setChapters([])
    setChapterConfigs({})
    setTopicsByChapter({})
    setLoadingTopicsByChapter({})
    setTestNickname('')
    setNegativeMarks('0')
    navigateToScreen(screenState.prepareTest)
  }

  async function loadPreviousTests() {
    setIsLoadingPreviousTests(true)
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/tests`)
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to fetch previous tests.')
      }

      setPreviousTests(Array.isArray(payload.data) ? payload.data : [])
      setPreviousTestsError('')
    } catch (error) {
      setPreviousTestsError(getReadableError(error, 'Unable to load previous tests.'))
      setPreviousTests([])
    } finally {
      setIsLoadingPreviousTests(false)
    }
  }

  async function loadAllTests() {
    setIsLoadingAllTests(true)
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/tests/all`)
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to fetch all tests.')
      }

      setAllTests(Array.isArray(payload.data) ? payload.data : [])
      setAllTestsError('')
    } catch (error) {
      setAllTestsError(getReadableError(error, 'Unable to load all tests.'))
      setAllTests([])
    } finally {
      setIsLoadingAllTests(false)
    }
  }

  async function openPreviousTestDetails(testId, scope = '') {
    const normalizedTestId = String(testId || '').trim()
    if (!normalizedTestId) {
      return
    }
    setSelectedPreviousTestId(normalizedTestId)
    setSelectedPreviousTest(null)
    setSelectedPreviousTestError('')
    setIsLoadingSelectedPreviousTest(true)
    try {
      const query = scope ? `?scope=${encodeURIComponent(scope)}` : ''
      const response = await apiFetch(
        `${API_BASE_URL}/api/tests/${encodeURIComponent(normalizedTestId)}${query}`,
      )
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to fetch test details.')
      }

      const list = scope === 'all' ? allTests : previousTests
      const listItem = list.find((item) => item.testId === normalizedTestId)
      setSelectedPreviousTest(scope !== 'all' && payload.data && listItem
        ? {
            ...payload.data,
            result: listItem.result,
            userAttemptNumber: listItem.userAttemptNumber,
            resultAttemptNumber: listItem.resultAttemptNumber,
          }
        : payload.data || null)
    } catch (error) {
      setSelectedPreviousTest(null)
      setSelectedPreviousTestError(getReadableError(error, 'Unable to load test details.'))
    } finally {
      setIsLoadingSelectedPreviousTest(false)
    }
  }

  function closePreviousTestDetails() {
    setSelectedPreviousTestId('')
    setSelectedPreviousTest(null)
    setSelectedPreviousTestError('')
  }

  async function retakePreviousTest(testId) {
    const normalizedTestId = String(testId || '').trim()
    if (!normalizedTestId) {
      setSelectedPreviousTestError('Invalid test id for retake.')
      return
    }

    setIsRetakingPreviousTest(true)
    setSelectedPreviousTestError('')
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/api/tests/${encodeURIComponent(normalizedTestId)}/retake`,
        {
          method: 'POST',
        },
      )
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to load retake test.')
      }

      const retakeQuestions = Array.isArray(payload?.data?.questions) ? payload.data.questions : []
      if (retakeQuestions.length === 0) {
        throw new Error('No questions available for this previous test.')
      }

      const durationMinutes = Number(payload?.data?.durationMinutes)
      const durationSeconds =
        Number.isInteger(durationMinutes) && durationMinutes > 0
          ? durationMinutes * 60
          : TEST_DURATION_SECONDS

      startTest(
        retakeQuestions,
        payload?.data?.testName || `Retake • ${normalizedTestId}`,
        durationSeconds,
        payload?.data?.displayNumber,
        payload?.data?.testId,
        payload?.data?.nickname,
        payload?.data?.markingScheme,
      )
    } catch (error) {
      setSelectedPreviousTestError(getReadableError(error, 'Unable to start this test.'))
    } finally {
      setIsRetakingPreviousTest(false)
    }
  }

  async function reviewTest(testId) {
    setIsReviewingTest(true)
    setSelectedPreviousTestError('')
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/api/tests/${encodeURIComponent(testId)}/review`,
      )
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to load the test review.')
      }
      if (!Array.isArray(payload.data?.questions) || !payload.data.result || !payload.data.answers) {
        throw new Error('The saved test review is incomplete.')
      }
      setSavedTestReview(payload.data)
      navigateToScreen(screenState.testReview)
    } catch (error) {
      setSelectedPreviousTestError(getReadableError(error, 'Unable to load the test review.'))
    } finally {
      setIsReviewingTest(false)
    }
  }

  function openPreviousTestsPage() {
    setPreviousTestsError('')
    setSelectedPreviousTestId('')
    setSelectedPreviousTest(null)
    setSelectedPreviousTestError('')
    setIsRetakingPreviousTest(false)
    void loadPreviousTests()
    navigateToScreen(screenState.previousTests)
  }

  function openAllTestsPage() {
    setSelectedPreviousTestId('')
    setSelectedPreviousTest(null)
    setSelectedPreviousTestError('')
    void loadAllTests()
    navigateToScreen(screenState.allTests)
  }

  function openPausedTestsPage() {
    void loadPausedTests()
    navigateToScreen(screenState.pausedTests)
  }

  function onSubjectChange(subject) {
    setSelectedSubject(subject)
    setPrepareTestError('')
    void loadChapters(subject)
  }

  function onChapterToggle(chapter, checked) {
    setSelectedChapters((prev) => {
      if (checked) {
        if (prev.includes(chapter)) {
          return prev
        }
        const [subject, chapterName] = chapter.split('||')
        void loadTopics(subject, chapterName)
        return [...prev, chapter]
      }
      return prev.filter((item) => item !== chapter)
    })
  }

  function onChapterDifficultyToggle(chapter, difficulty, checked) {
    setChapterConfigs((prev) => {
      const current = prev[chapter] || {
        difficulties: [...DIFFICULTY_LEVELS],
        topics: [],
        startQuestionNumber: '',
        endQuestionNumber: '',
      }
      const currentSet = new Set(current.difficulties)
      if (checked) {
        currentSet.add(difficulty)
      } else {
        currentSet.delete(difficulty)
      }
      return {
        ...prev,
        [chapter]: {
          ...current,
          difficulties: [...currentSet],
        },
      }
    })
  }

  function onChapterTopicToggle(chapter, topic, checked) {
    setChapterConfigs((prev) => {
      const current = prev[chapter] || {
        difficulties: [...DIFFICULTY_LEVELS],
        topics: [],
        startQuestionNumber: '',
        endQuestionNumber: '',
      }
      const currentSet = new Set(Array.isArray(current.topics) ? current.topics : [])
      if (checked) {
        currentSet.add(topic)
      } else {
        currentSet.delete(topic)
      }
      return {
        ...prev,
        [chapter]: {
          ...current,
          topics: [...currentSet],
        },
      }
    })
  }

  function onChapterRangeChange(chapter, field, value) {
    setChapterConfigs((prev) => {
      const current = prev[chapter] || {
        difficulties: [...DIFFICULTY_LEVELS],
        topics: [],
        startQuestionNumber: '',
        endQuestionNumber: '',
      }
      return {
        ...prev,
        [chapter]: {
          ...current,
          [field]: value,
        },
      }
    })
  }

  async function createTestFromSelection() {
    const parsedTotalQuestions = Number(totalQuestions)
    const parsedTestTimeMinutes = Number(testTimeMinutes)
    const parsedNegativeMarks = Number(negativeMarks || 0)

    if (selectedChapters.length === 0) {
      setPrepareTestError('Please select at least one chapter.')
      return
    }
    if (!Number.isInteger(parsedTotalQuestions) || parsedTotalQuestions <= 0) {
      setPrepareTestError('Total questions must be a positive number.')
      return
    }
    if (!Number.isInteger(parsedTestTimeMinutes) || parsedTestTimeMinutes <= 0) {
      setPrepareTestError('Test time must be a positive number of minutes.')
      return
    }

    if (!Number.isFinite(parsedNegativeMarks) || parsedNegativeMarks < 0 || parsedNegativeMarks > 10) {
      setPrepareTestError('Negative marks must be a number between 0 and 10.')
      return
    }

    for (const chapterKey of selectedChapters) {
      const [subject, chapter] = chapterKey.split('||')
      const isGeneralAwareness = isGeneralAwarenessSubject(subject)
      const config = chapterConfigs[chapterKey]
      if (
        !isGeneralAwareness &&
        (!config || !Array.isArray(config.difficulties) || config.difficulties.length === 0)
      ) {
        setPrepareTestError(`Select at least one difficulty for chapter "${chapter}".`)
        return
      }
      const chapterTopics = topicsByChapter[chapterKey]
      if (
        Array.isArray(chapterTopics) &&
        chapterTopics.length > 0 &&
        (!Array.isArray(config?.topics) || config.topics.length === 0)
      ) {
        setPrepareTestError(`Select at least one topic for chapter "${chapter}".`)
        return
      }
      if (!isGeneralAwareness) {
        const start =
          config.startQuestionNumber === '' ? null : Number(config.startQuestionNumber)
        const end = config.endQuestionNumber === '' ? null : Number(config.endQuestionNumber)
        if (start !== null && (!Number.isInteger(start) || start <= 0)) {
          setPrepareTestError(`Invalid start question number for chapter "${chapter}".`)
          return
        }
        if (end !== null && (!Number.isInteger(end) || end <= 0)) {
          setPrepareTestError(`Invalid end question number for chapter "${chapter}".`)
          return
        }
        if (start !== null && end !== null && start > end) {
          setPrepareTestError(
            `Question number range is invalid for chapter "${chapter}" (From > To).`,
          )
          return
        }
      }
    }

    setIsCreatingTest(true)
    const selections = selectedChapters.map((key) => {
      const [subject, chapter] = key.split('||')
      return { key, subject, chapter }
    })
    setPrepareTestError('')
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/questions/create-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: selections[0].subject,
          nickname: testNickname.trim(),
          chapters: selections.map((item) => item.chapter),
          selections: selections.map((item) => {
            const isGeneralAwareness = isGeneralAwarenessSubject(item.subject)
            const config = chapterConfigs[item.key] || {
              difficulties: [...DIFFICULTY_LEVELS],
              topics: [],
              startQuestionNumber: '',
              endQuestionNumber: '',
            }
            return {
              subject: item.subject,
              chapter: item.chapter,
              difficulties:
                isGeneralAwareness || !Array.isArray(config.difficulties) || config.difficulties.length === 0
                  ? [...DIFFICULTY_LEVELS]
                  : config.difficulties,
              topics: config.topics,
              startQuestionNumber: isGeneralAwareness ? '' : config.startQuestionNumber,
              endQuestionNumber: isGeneralAwareness ? '' : config.endQuestionNumber,
            }
          }),
          totalQuestions: parsedTotalQuestions,
          durationMinutes: parsedTestTimeMinutes,
          markingScheme: {
            correct: 1,
            incorrect: -parsedNegativeMarks,
          },
        }),
      })
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to create test.')
      }

      const testQuestions = Array.isArray(payload?.data?.questions)
        ? payload.data.questions
        : []

      if (testQuestions.length === 0) {
        throw new Error('No test questions were generated for your selection.')
      }

      const subjectNames = [...new Set(selections.map((item) => item.subject))]
      const label = `Mock Test • ${subjectNames.join(', ')} • ${selections
        .map((item) => item.chapter)
        .join(', ')}`
      startTest(
        testQuestions,
        label,
        parsedTestTimeMinutes * 60,
        payload?.data?.displayNumber,
        payload?.data?.testId,
        payload?.data?.nickname,
        payload?.data?.markingScheme,
      )
    } catch (error) {
      setPrepareTestError(getReadableError(error, 'Unable to create test.'))
    } finally {
      setCreateProgress(100)
      setIsCreatingTest(false)
    }
  }

  const userIcon = currentUser && (
    <span className="app-user-avatar" aria-label={`Current user: ${currentUser.name}`}>
      {currentUser.name?.charAt(0) || '?'}
    </span>
  )

  return (
    <main className="app-shell">
      {screen === screenState.userSelect && (
        <UserSelectScreen users={USERS} onSelectUser={chooseUser} />
      )}

      {screen === screenState.login && loginUser && (
        <LoginScreen
          user={loginUser}
          error={loginError}
          isSubmitting={isLoggingIn}
          onSubmit={submitLogin}
          onBack={cancelLogin}
        />
      )}

      {screen === screenState.home && (
        <HomeScreen
          userIcon={userIcon}
          onLogout={logout}
          onViewPausedTests={openPausedTestsPage}
          onPrepareTest={openPrepareTestPage}
          onViewPreviousTests={openPreviousTestsPage}
          onViewAllTests={openAllTestsPage}
        />
      )}

      {screen === screenState.allTests && (
        <PreviousTestsScreen
          userIcon={userIcon}
          title="All Tests"
          badge="All Users"
          showOwner
          testActionLabel="Take Test"
          emptyText="No tests have been created yet."
          loadingText="Loading all tests..."
          previousTests={allTests}
          isLoading={isLoadingAllTests}
          loadError={allTestsError}
          selectedTestId={selectedPreviousTestId}
          selectedTest={selectedPreviousTest}
          isLoadingSelectedTest={isLoadingSelectedPreviousTest}
          selectedTestError={selectedPreviousTestError}
          onOpenTest={(testId) => openPreviousTestDetails(testId, 'all')}
          onRetakeTest={retakePreviousTest}
          onReviewTest={reviewTest}
          onCloseTest={closePreviousTestDetails}
          isRetakingTest={isRetakingPreviousTest}
          isReviewingTest={isReviewingTest}
          onBack={() => window.history.back()}
          onRefresh={loadAllTests}
        />
      )}

      {screen === screenState.pausedTests && (
        <PausedTestsScreen
          userIcon={userIcon}
          pausedTests={pausedTests}
          isLoading={isLoadingPausedTests}
          loadError={pausedTestsError}
          resumingPausedId={resumingPausedId}
          onResume={resumePausedTest}
          onDiscard={discardPausedTest}
          onBack={() => window.history.back()}
          onRefresh={() => void loadPausedTests()}
        />
      )}

      {screen === screenState.previousTests && (
        <PreviousTestsScreen
          userIcon={userIcon}
          previousTests={previousTests}
          isLoading={isLoadingPreviousTests}
          loadError={previousTestsError}
          selectedTestId={selectedPreviousTestId}
          selectedTest={selectedPreviousTest}
          isLoadingSelectedTest={isLoadingSelectedPreviousTest}
          selectedTestError={selectedPreviousTestError}
          onOpenTest={openPreviousTestDetails}
          onRetakeTest={retakePreviousTest}
          onCloseTest={closePreviousTestDetails}
          isRetakingTest={isRetakingPreviousTest}
          onBack={backToHome}
          onRefresh={loadPreviousTests}
        />
      )}

      {screen === screenState.prepareTest && (
        <AvailablePdfsScreen
          userIcon={userIcon}
          subjects={subjects}
          chapters={chapters}
          selectedSubject={selectedSubject}
          selectedChapters={selectedChapters}
          chapterConfigs={chapterConfigs}
          topicsByChapter={topicsByChapter}
          loadingTopicsByChapter={loadingTopicsByChapter}
          isGeneralAwarenessSubject={isGeneralAwarenessSubject(selectedSubject)}
          totalQuestions={totalQuestions}
          testTimeMinutes={testTimeMinutes}
          isLoadingSubjects={isLoadingSubjects}
          isLoadingChapters={isLoadingChapters}
          isCreatingTest={isCreatingTest}
          createProgress={createProgress}
          prepareTestError={prepareTestError}
          onBack={backToHome}
          onSubjectChange={onSubjectChange}
          onChapterToggle={onChapterToggle}
          onChapterDifficultyToggle={onChapterDifficultyToggle}
          onChapterTopicToggle={onChapterTopicToggle}
          onChapterRangeChange={onChapterRangeChange}
          testNickname={testNickname}
          negativeMarks={negativeMarks}
          onNegativeMarksChange={setNegativeMarks}
          onTestNicknameChange={setTestNickname}
          onTotalQuestionsChange={setTotalQuestions}
          onTestTimeChange={setTestTimeMinutes}
          onCreateTest={createTestFromSelection}
        />
      )}

      {screen === screenState.test && (
        <TestScreen
          userIcon={userIcon}
          questions={activeQuestions}
          testTitle={activeTestLabel}
          testNumber={activeTestNumber}
          testNickname={activeTestNickname}
          answers={answers}
          visitedQuestionIds={visitedQuestionIds}
          reviewQuestionIds={reviewQuestionIds}
          currentQuestionIndex={currentQuestionIndex}
          secondsLeft={secondsLeft}
          onSelectAnswer={selectAnswer}
          onClearAnswer={clearAnswer}
          onToggleReview={toggleMarkForReview}
          onQuestionChange={goToQuestion}
          onPrevious={moveToPreviousQuestion}
          onNext={moveToNextQuestion}
          onSubmit={submitTest}
          onPause={pauseTest}
          isPausing={isPausing}
          pauseError={pauseError}
        />
      )}

      {screen === screenState.result && (
        <ResultScreen
          userIcon={userIcon}
          result={result}
          questions={activeQuestions}
          answers={answers}
          testNumber={activeTestNumber}
          testNickname={activeTestNickname}
          onBackToHome={backToHome}
        />
      )}
      {screen === screenState.testReview && savedTestReview && (
        <ResultScreen
          userIcon={userIcon}
          result={savedTestReview.result}
          questions={savedTestReview.questions}
          answers={savedTestReview.answers}
          testNumber={savedTestReview.displayNumber}
          testNickname={savedTestReview.nickname}
          onBackToHome={() => window.history.back()}
          backLabel="Back to All Tests"
          reviewNotice={savedTestReview.reconstructed
            ? 'This older attempt uses the current question bank because its original questions were not saved.'
            : ''}
        />
      )}
    </main>
  )
}
