import './env.js'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import { randomBytes, createHash } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { User, Job, Application, ContactMessage } from './models.js'
import { requireAuth, allowRoles } from './middleware.js'
import { resumeDirectory, resumeUpload } from './uploads.js'
import { configureDnsFromEnv } from './configure-dns.js'

const app = express()
configureDnsFromEnv()
const port = process.env.PORT || 5000

app.use(helmet())
app.use(cors({
  origin: [
    ...(process.env.CLIENT_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean),
    'http://localhost:5173',
    'http://localhost:5174',
  ],
}))
app.use(express.json({ limit: '1mb' }))
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: 'draft-8', legacyHeaders: false }))

app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }))
app.use('/api', (_req, res, next) => {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: 'Database is unavailable. Configure MONGO_URI and ensure MongoDB is running.' })
  next()
})

app.post('/api/auth/register', resumeUpload.single('resume'), async (req, res, next) => {
  try {
    const body = req.body || {}
    const { role } = body
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const location = typeof body.location === 'string' ? body.location.trim() : ''
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : ''
    if (!name || !email || !password || !phone || !location) return res.status(400).json({ message: 'Name, email, password, phone and location are required.' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' })
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' })
    if (!['student', 'recruiter'].includes(role)) return res.status(400).json({ message: 'Choose a student or recruiter account.' })
    if (role === 'recruiter' && !companyName) return res.status(400).json({ message: 'Company name is required for recruiter accounts.' })
    const user = await User.create({ name, email, password, role, companyName, phone, location, resumePath: req.file?.filename, resumeName: req.file?.originalname })
    res.status(201)
    sendSession(res, user, 'Account created successfully.')
  } catch (error) {
    if (req.file) await unlink(req.file.path).catch(() => {})
    next(error)
  }
})

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const body = req.body || {}
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const role = body.role
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' })
    if (role !== undefined && !['student', 'recruiter', 'admin'].includes(role)) return res.status(400).json({ message: 'Choose a valid account type.' })
    const user = await User.findOne({ email }).select('+password')
    if (!user || user.disabled || !(await user.comparePassword(password)) || (role && user.role !== role)) return res.status(401).json({ message: 'Email or password is incorrect.' })
    sendSession(res, user)
  } catch (error) { next(error) }
})

app.post('/api/auth/forgot-password', async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : ''
    if (!email) return res.status(400).json({ message: 'Enter the email address for your account.' })
    const smtpReady = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.EMAIL_FROM
    if (!smtpReady) return res.status(503).json({ message: 'Password recovery email is not configured. Set SMTP settings in .env to enable it.' })
    const user = await User.findOne({ email, disabled: false })
    if (user) {
      const token = randomBytes(32).toString('hex')
      user.passwordResetTokenHash = createHash('sha256').update(token).digest('hex')
      user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000)
      await user.save()
      const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } })
      const clientOrigin = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim()
      const resetUrl = `${clientOrigin}/reset-password/${token}`
      await transport.sendMail({ from: process.env.EMAIL_FROM, to: user.email, subject: 'Reset your Pathway password', text: `Use this link within one hour to reset your password: ${resetUrl}` })
    }
    res.json({ message: 'If that email is registered, password reset instructions have been sent.' })
  } catch (error) { next(error) }
})

app.post('/api/auth/reset-password/:token', async (req, res, next) => {
  try {
    if (typeof req.body?.password !== 'string' || req.body.password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' })
    const tokenHash = createHash('sha256').update(req.params.token).digest('hex')
    const user = await User.findOne({ passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: new Date() }, disabled: false }).select('+passwordResetTokenHash +passwordResetExpiresAt +password')
    if (!user) return res.status(400).json({ message: 'This password reset link is invalid or has expired.' })
    user.password = req.body.password
    user.passwordResetTokenHash = undefined
    user.passwordResetExpiresAt = undefined
    await user.save()
    res.json({ message: 'Password updated. You can now sign in.' })
  } catch (error) { next(error) }
})

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: safeUser(req.user) }))

app.get('/api/jobs', async (req, res, next) => {
  try {
    const filter = { status: 'active' }
    if (req.query.location) filter.location = { $regex: escapeRegex(req.query.location), $options: 'i' }
    if (req.query.type && req.query.type !== 'All types') filter.type = req.query.type
    if (req.query.q) filter.$or = ['title', 'companyName', 'description', 'category'].map((field) => ({ [field]: { $regex: escapeRegex(req.query.q), $options: 'i' } }))
    const jobs = await Job.find(filter).sort({ createdAt: -1 }).limit(100).lean()
    res.json({ jobs })
  } catch (error) { next(error) }
})

app.get('/api/jobs/mine', requireAuth, allowRoles('recruiter'), async (req, res, next) => {
  try {
    const jobs = await Job.find({ recruiter: req.user._id }).sort({ createdAt: -1 }).lean()
    res.json({ jobs })
  } catch (error) { next(error) }
})

app.get('/api/jobs/admin/all', requireAuth, allowRoles('admin'), async (_req, res, next) => {
  try {
    const jobs = await Job.find().populate('recruiter', 'name email companyName').sort({ createdAt: -1 }).lean()
    res.json({ jobs })
  } catch (error) { next(error) }
})

app.get('/api/jobs/:id/manage', requireAuth, allowRoles('recruiter', 'admin'), async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).lean()
    if (!job) return res.status(404).json({ message: 'Job not found.' })
    if (req.user.role !== 'admin' && !job.recruiter.equals(req.user._id)) return res.status(403).json({ message: 'You can only manage your own openings.' })
    res.json({ job })
  } catch (error) { next(error) }
})

app.get('/api/jobs/:id', async (req, res, next) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, status: 'active' }).populate('recruiter', 'name companyName location').lean()
    if (!job) return res.status(404).json({ message: 'This job is no longer available.' })
    res.json({ job })
  } catch (error) { next(error) }
})

app.post('/api/jobs', requireAuth, allowRoles('recruiter', 'admin'), async (req, res, next) => {
  try {
    const { title, location, type, salary, description, category } = req.body
    if (!title || !location || !description) return res.status(400).json({ message: 'Title, location and description are required.' })
    const job = await Job.create({ title, location, type, salary, description, category, companyName: req.user.companyName || 'Pathway employer', recruiter: req.user._id })
    res.status(201).json({ job })
  } catch (error) { next(error) }
})

app.patch('/api/jobs/:id', requireAuth, allowRoles('recruiter', 'admin'), async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id)
    if (!job) return res.status(404).json({ message: 'Job not found.' })
    if (req.user.role !== 'admin' && !job.recruiter.equals(req.user._id)) return res.status(403).json({ message: 'You can only manage your own openings.' })
    for (const key of ['title', 'location', 'type', 'salary', 'description', 'category', 'status']) if (req.body[key] !== undefined) job[key] = req.body[key]
    await job.save()
    res.json({ job })
  } catch (error) { next(error) }
})

app.delete('/api/jobs/:id', requireAuth, allowRoles('recruiter', 'admin'), async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id)
    if (!job) return res.status(404).json({ message: 'Job not found.' })
    if (req.user.role !== 'admin' && !job.recruiter.equals(req.user._id)) return res.status(403).json({ message: 'You can only remove your own openings.' })
    const applications = await Application.find({ job: job._id }).select('resumePath').lean()
    await Application.deleteMany({ job: job._id })
    await Job.deleteOne({ _id: job._id })
    await Promise.all(applications.map((application) => unlink(path.join(resumeDirectory, application.resumePath)).catch(() => {})))
    res.json({ message: 'Job and its applications were removed.' })
  } catch (error) { next(error) }
})

app.post('/api/contact', async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body
    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) return res.status(400).json({ message: 'Complete every field before sending your message.' })
    await ContactMessage.create({ name, email, subject, message })
    res.status(201).json({ message: 'Thanks for getting in touch. Your message has been received.' })
  } catch (error) { next(error) }
})

app.get('/api/contact', requireAuth, allowRoles('admin'), async (_req, res, next) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 }).lean()
    res.json({ messages })
  } catch (error) { next(error) }
})

app.get('/api/applications/mine', requireAuth, allowRoles('student'), async (req, res, next) => {
  try {
    const applications = await Application.find({ applicant: req.user._id }).populate('job', 'title companyName location').sort({ createdAt: -1 }).lean()
    res.json({ applications })
  } catch (error) { next(error) }
})

app.get('/api/applications', requireAuth, allowRoles('recruiter', 'admin'), async (req, res, next) => {
  try {
    let filter = {}
    if (req.user.role === 'recruiter') {
      const jobs = await Job.find({ recruiter: req.user._id }).select('_id').lean()
      filter.job = { $in: jobs.map((job) => job._id) }
    }
    const applications = await Application.find(filter).populate('job', 'title companyName recruiter').populate('applicant', 'name email location').sort({ createdAt: -1 }).lean()
    res.json({ applications })
  } catch (error) { next(error) }
})

app.post('/api/applications', requireAuth, allowRoles('student'), resumeUpload.single('resume'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Attach a resume to apply.' })
    const job = await Job.findOne({ _id: req.body.jobId, status: 'active' })
    if (!job) return res.status(404).json({ message: 'This job is no longer accepting applications.' })
    const application = await Application.create({ job: job._id, applicant: req.user._id, coverLetter: req.body.coverLetter, resumePath: req.file.filename, resumeName: req.file.originalname })
    res.status(201).json({ application: { id: application._id, status: application.status } })
  } catch (error) {
    if (req.file) await import('node:fs/promises').then(({ unlink }) => unlink(req.file.path).catch(() => {}))
    next(error)
  }
})

app.patch('/api/applications/:id', requireAuth, allowRoles('recruiter', 'admin'), async (req, res, next) => {
  try {
    if (!['Submitted', 'In review', 'Interview', 'Offer', 'Rejected'].includes(req.body.status)) return res.status(400).json({ message: 'Choose a valid application status.' })
    const application = await Application.findById(req.params.id).populate('job', 'recruiter')
    if (!application) return res.status(404).json({ message: 'Application not found.' })
    if (req.user.role !== 'admin' && !application.job.recruiter.equals(req.user._id)) return res.status(403).json({ message: 'You can only update applicants for your openings.' })
    application.status = req.body.status
    await application.save()
    res.json({ application: { id: application._id, status: application.status } })
  } catch (error) { next(error) }
})

app.get('/api/applications/:id/resume', requireAuth, async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id).populate('job', 'recruiter')
    if (!application) return res.status(404).json({ message: 'Application not found.' })
    const isApplicant = application.applicant.equals(req.user._id)
    const isRecruiter = application.job.recruiter.equals(req.user._id)
    if (!isApplicant && !isRecruiter && req.user.role !== 'admin') return res.status(403).json({ message: 'You cannot access this resume.' })
    res.download(path.join(resumeDirectory, application.resumePath), application.resumeName)
  } catch (error) { next(error) }
})

app.get('/api/users/me', requireAuth, (req, res) => res.json({ user: safeUser(req.user) }))
app.get('/api/users/me/resume', requireAuth, allowRoles('student'), (req, res) => {
  if (!req.user.resumePath) return res.status(404).json({ message: 'No resume is saved to your profile yet.' })
  res.download(path.join(resumeDirectory, req.user.resumePath), req.user.resumeName || 'resume')
})

app.patch('/api/users/me', requireAuth, resumeUpload.single('resume'), async (req, res, next) => {
  let previousResume
  try {
    previousResume = req.user.resumePath
    const fields = req.user.role === 'student' ? ['name', 'headline', 'phone', 'location', 'skills', 'bio'] : ['name', 'companyName', 'phone', 'location', 'skills', 'bio']
    for (const field of fields) if (req.body[field] !== undefined) req.user[field] = field === 'skills' && typeof req.body[field] === 'string' ? req.body[field].split(',').map((skill) => skill.trim()).filter(Boolean) : req.body[field]
    if (req.file && req.user.role === 'student') {
      req.user.resumePath = req.file.filename
      req.user.resumeName = req.file.originalname
    }
    await req.user.save()
    if (req.file && previousResume) await unlink(path.join(resumeDirectory, previousResume)).catch(() => {})
    res.json({ user: safeUser(req.user) })
  } catch (error) {
    if (req.file) await unlink(req.file.path).catch(() => {})
    next(error)
  }
})
app.put('/api/users/me/saved-jobs/:jobId', requireAuth, allowRoles('student'), async (req, res, next) => {
  try {
    const job = await Job.findOne({ _id: req.params.jobId, status: 'active' }).select('_id')
    if (!job) return res.status(404).json({ message: 'This job is no longer available.' })
    await User.updateOne({ _id: req.user._id }, { $addToSet: { savedJobs: job._id } })
    res.json({ saved: true, jobId: job.id })
  } catch (error) { next(error) }
})
app.delete('/api/users/me/saved-jobs/:jobId', requireAuth, allowRoles('student'), async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $pull: { savedJobs: req.params.jobId } })
    res.json({ saved: false, jobId: req.params.jobId })
  } catch (error) { next(error) }
})
app.get('/api/users', requireAuth, allowRoles('admin'), async (_req, res, next) => {
  try { res.json({ users: (await User.find().sort({ createdAt: -1 }).lean()).map(safeUser) }) } catch (error) { next(error) }
})
app.patch('/api/users/:id/disable', requireAuth, allowRoles('admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ message: 'You cannot disable your own account.' })
    if (typeof req.body?.disabled !== 'boolean') return res.status(400).json({ message: 'Disabled must be true or false.' })
    const user = await User.findByIdAndUpdate(req.params.id, { disabled: req.body.disabled }, { new: true, runValidators: true })
    if (!user) return res.status(404).json({ message: 'User not found.' })
    res.json({ user: safeUser(user) })
  } catch (error) { next(error) }
})

app.use((error, _req, res, _next) => {
  if (error.code === 11000) return res.status(409).json({ message: 'An account or application with those details already exists.' })
  if (error.name === 'ValidationError') return res.status(400).json({ message: Object.values(error.errors).map((item) => item.message).join(' ') })
  if (error.name === 'MulterError') return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Resume must be 5 MB or smaller.' : 'Resume upload was not accepted.' })
  if (error.message?.startsWith('Please upload')) return res.status(400).json({ message: error.message })
  console.error(error)
  res.status(500).json({ message: 'The server could not complete that request.' })
})

function sendSession(res, user, message) {
  res.json({ token: jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' }), user: safeUser(user), ...(message ? { message } : {}) })
}
function safeUser(user) {
  if (!user) return user
  const value = typeof user.toObject === 'function' ? user.toObject() : user
  const { password, __v, passwordResetTokenHash, passwordResetExpiresAt, resumePath, ...safe } = value
  return safe
}
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required.')
if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.')

try {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB.')
} catch {
  console.error('MongoDB connection failed. Check MONGO_URI and Atlas network access.')
  process.exit(1)
}

app.listen(port, () => console.log(`Pathway API listening on port ${port}.`))