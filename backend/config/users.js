const users = new Map([
  ['H', { id: 'H', name: 'H' }],
  ['V', { id: 'V', name: 'V' }],
])

function listUsers() {
  return [...users.values()].map(({ id, name }) => ({ id, name }))
}

function getUser(userId) {
  const user = users.get(String(userId || ''))
  return user ? { id: user.id, name: user.name } : null
}
module.exports = { listUsers, getUser }
