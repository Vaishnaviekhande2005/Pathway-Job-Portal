import './env.js'
import mongoose from 'mongoose'
import { User } from './models.js'
import { configureDnsFromEnv } from './configure-dns.js'

configureDnsFromEnv()
const { MONGO_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET } = process.env
if (!MONGO_URI || !JWT_SECRET || !ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('Set MONGO_URI, JWT_SECRET, ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in server/.env.')
}
if (ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.')

try {
  await mongoose.connect(MONGO_URI)
  const email = ADMIN_EMAIL.trim().toLowerCase()
  const existing = await User.findOne({ email })
  if (existing) {
    if (existing.role !== 'admin') throw new Error('The configured admin email belongs to a non-admin account. No account was changed.')
    console.log('Admin account already exists.')
  } else {
    await User.create({ name: ADMIN_NAME, email, password: ADMIN_PASSWORD, role: 'admin' })
    console.log('Admin account created.')
  }
} finally {
  await mongoose.disconnect()
}