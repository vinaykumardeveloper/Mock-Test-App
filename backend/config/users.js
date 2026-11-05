const crypto = require('crypto')

// Initial passwords can be overridden via USER_H_PASSWORD / USER_V_PASSWORD in .env.
const USER_DEFINITIONS = [
  { id: 'H', name: 'H', envKey: 'USER_H_PASSWORD', defaultPassword: 'H@123' },
  { id: 'V', name: 'V', envKey: 'USER_V_PASSWORD', defaultPassword: 'V@123' },
]

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64)
}

const users = new Map()
for (const definition of USER_DEFINITIONS) {
  const salt = crypto.randomBytes(16)
  const password = process.env[definition.envKey] || definition.defaultPassword
  users.set(definition.id, {
    id: definition.id,
    name: definition.name,
    salt,
    passwordHash: hashPassword(password, salt),
  })
}

function listUsers() {
  return [...users.values()].map(({ id, name }) => ({ id, name }))
}

function getUser(userId) {
  const user = users.get(String(userId || ''))
  return user ? { id: user.id, name: user.name } : null
}

function verifyPassword(userId, password) {
  const user = users.get(String(userId || ''))
  if (!user || typeof password !== 'string') {
    return false
  }
  const candidate = hashPassword(password, user.salt)
  return crypto.timingSafeEqual(candidate, user.passwordHash)
}

module.exports = { listUsers, getUser, verifyPassword }
