import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address.'] },
  password: { type: String, required: true, minlength: 8, select: false },
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpiresAt: { type: Date, select: false },
  role: { type: String, enum: ['student', 'recruiter', 'admin'], default: 'student' },
  companyName: { type: String, required: function requiredCompanyName() { return this.role === 'recruiter' }, trim: true, maxlength: 120 },
  headline: { type: String, trim: true, maxlength: 140 },
  phone: { type: String, required: function requiredPhone() { return this.role !== 'admin' }, trim: true, maxlength: 30 },
  location: { type: String, required: function requiredLocation() { return this.role !== 'admin' }, trim: true, maxlength: 120 },
  resumePath: { type: String },
  resumeName: { type: String, trim: true, maxlength: 255 },
  savedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }],
  skills: [{ type: String, trim: true, maxlength: 40 }],
  bio: { type: String, trim: true, maxlength: 1500 },
  disabled: { type: Boolean, default: false },
}, { timestamps: true })

userSchema.pre('save', async function hashPassword() {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12)
})
userSchema.methods.comparePassword = function comparePassword(password) { return bcrypt.compare(password, this.password) }

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  companyName: { type: String, required: true, trim: true, maxlength: 120 },
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  location: { type: String, required: true, trim: true, maxlength: 120 },
  type: { type: String, enum: ['Full-time', 'Part-time', 'Internship', 'Contract'], default: 'Full-time' },
  salary: { type: String, trim: true, maxlength: 100 },
  category: { type: String, trim: true, maxlength: 80 },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
}, { timestamps: true })
jobSchema.index({ title: 'text', companyName: 'text', description: 'text', category: 'text' })

const applicationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coverLetter: { type: String, trim: true, maxlength: 3000 },
  resumePath: { type: String, required: true },
  resumeName: { type: String, required: true },
  status: { type: String, enum: ['Submitted', 'In review', 'Interview', 'Offer', 'Rejected'], default: 'Submitted' },
}, { timestamps: true })
applicationSchema.index({ job: 1, applicant: 1 }, { unique: true })

const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true },
  subject: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 3000 },
  resolved: { type: Boolean, default: false },
}, { timestamps: true })

export const User = mongoose.models.User || mongoose.model('User', userSchema)
export const Job = mongoose.models.Job || mongoose.model('Job', jobSchema)
export const Application = mongoose.models.Application || mongoose.model('Application', applicationSchema)
export const ContactMessage = mongoose.models.ContactMessage || mongoose.model('ContactMessage', contactMessageSchema)