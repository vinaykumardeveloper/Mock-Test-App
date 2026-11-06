const express = require('express')
const { listUsers, getUser } = require('../config/users')
const { createToken, authenticate } = require('../middleware/auth')

const router = express.Router()

router.get('/users', (req, res) => {
  res.json({ success: true, data: listUsers() })
})

router.post('/login', (req, res) => {
  const userId = String(req.body?.userId || '')
  const user = getUser(userId)

  if (!user) {
    res.status(400).json({
      success: false,
      message: 'Invalid user.',
    })
    return
  }

  res.json({
    success: true,
    data: { token: createToken(userId), user },
  })
})

router.get('/me', authenticate, (req, res) => {
  res.json({ success: true, data: req.user })
})

module.exports = router
