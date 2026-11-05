const express = require('express')
const dotenv = require('dotenv')

dotenv.config()

const cors = require('cors')
const mongoose = require('mongoose')
const { connectDb, isDbConnected } = require('./config/db')
const { authenticate } = require('./middleware/auth')
const authRoutes = require('./routes/authRoutes')
const questionRoutes = require('./routes/questionRoutes')
const testRoutes = require('./routes/testRoutes')
const pausedTestRoutes = require('./routes/pausedTestRoutes')

const app = express()
const port = Number(process.env.PORT) || 5000

const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true)
        return
      }

      const isConfiguredOrigin = configuredOrigins.includes(origin)
      const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(
        origin,
      )

      if (isConfiguredOrigin || isLocalDevOrigin) {
        callback(null, true)
        return
      }

      callback(new Error(`CORS blocked for origin: ${origin}`))
    },
  }),
)
app.use(express.json({ limit: '5mb' }))

app.get('/api/health', (req, res) => {
  const dbConnected = isDbConnected()

  res.json({
    success: true,
    message: dbConnected
      ? 'Backend is running and database is connected.'
      : 'Backend is running but database is disconnected.',
    database: {
      status: dbConnected ? 'connected' : 'disconnected',
      readyState: mongoose.connection.readyState,
    },
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/questions', authenticate, questionRoutes)
app.use('/api/tests', authenticate, testRoutes)
app.use('/api/paused-tests', authenticate, pausedTestRoutes)

app.use((err, req, res, next) => {
  const statusCode = err && err.statusCode ? err.statusCode : 500
  const message = err && err.message ? err.message : 'Internal server error'

  res.status(statusCode).json({
    success: false,
    message,
  })
})

async function connectDbWithRetry() {
  try {
    await connectDb()
    console.log('MongoDB connected.')
  } catch (error) {
    console.error('MongoDB connection failed:', error.message)
    console.log('Retrying MongoDB connection in 10 seconds...')
    setTimeout(() => {
      void connectDbWithRetry()
    }, 10000)
  }
}

app.listen(port, () => {
  console.log(`Server started on port ${port}`)
  void connectDbWithRetry()
})
