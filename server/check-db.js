import './env.js'
import mongoose from 'mongoose'
import { configureDnsFromEnv } from './configure-dns.js'

configureDnsFromEnv()

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is not set. Configure server/.env or the backend environment.')
  process.exitCode = 1
} else {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('Connected to MongoDB.')
  } catch (error) {
    const code = error.code ? `, ${error.code}` : ''
    console.error(`MongoDB connection failed (${error.name}${code}). Check MONGO_URI and Atlas network access.`)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}
