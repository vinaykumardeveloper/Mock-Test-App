const crypto = require('crypto')
const { getUser } = require('../config/users')

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000

// Without AUTH_SECRET a random secret is used, so sessions end on server restart.
const secret = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex')

function sign(value) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url')
}

function createToken(userId) {
  const payload = Buffer.from(
    JSON.stringify({ u: userId, exp: Date.now() + TOKEN_TTL_MS }),
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function verifyToken(token) {
  const [payload, signature] = String(token || '').split('.')
  if (!payload || !signature) {
    return null
  }

  const expected = Buffer.from(sign(payload))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!data || typeof data.exp !== 'number' || data.exp < Date.now()) {
      return null
    }
    return getUser(data.u)
  } catch {
    return null
  }
}

function authenticate(req, res, next) {
  const header = String(req.headers.authorization || '')
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const user = verifyToken(token)

  if (!user) {
    res.status(401).json({ success: false, message: 'Please log in to continue.' })
    return
  }

  req.user = user
  next()
}

module.exports = { createToken, authenticate }
