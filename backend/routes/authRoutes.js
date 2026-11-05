const express = require('express')
const { listUsers, getUser, verifyPassword } = require('../config/users')
const { createToken, authenticate } = require('../middleware/auth')

const router = express.Router()

const MAX_FAILED_ATTEMPTS = 5
const LOCK_MS = 60 * 1000
const failedAttempts = new Map()

router.get('/users', (req, res) => {
  res.json({ success: true, data: listUsers() })
})

router.post('/login', (req, res) => {
  const userId = String(req.body?.userId || '')
  const password = req.body?.password

  const entry = failedAttempts.get(userId)
  if (entry && entry.count >= MAX_FAILED_ATTEMPTS && entry.lockedUntil > Date.now()) {
    res.status(429).json({
      success: false,
      message: 'Too many failed attempts. Please try again in a minute.',
    })
    return
  }

  if (!verifyPassword(userId, password)) {
    const count = entry && entry.lockedUntil > Date.now() - LOCK_MS ? entry.count + 1 : 1
    failedAttempts.set(userId, { count, lockedUntil: Date.now() + LOCK_MS })
    res.status(401).json({ success: false, message: 'Incorrect password.' })
    return
  }

  failedAttempts.delete(userId)
  res.json({
    success: true,
    data: { token: createToken(userId), user: getUser(userId) },
  })
})

router.get('/me', authenticate, (req, res) => {
  res.json({ success: true, data: req.user })
})

module.exports = router
