const mongoose = require('mongoose')

async function connectDb() {
  const mongoUri = process.env.MONGODB_URI

  if (!mongoUri) {
    throw new Error('MONGODB_URI is missing in environment variables.')
  }

  await mongoose.connect(mongoUri)
  return mongoose.connection
}

function isDbConnected() {
  return mongoose.connection.readyState === 1
}

module.exports = {
  connectDb,
  isDbConnected,
}
