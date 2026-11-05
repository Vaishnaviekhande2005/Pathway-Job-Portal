import './env.js'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import multer from 'multer'

const here = path.dirname(fileURLToPath(import.meta.url))
export const resumeDirectory = path.resolve(process.env.RESUME_UPLOAD_DIR || path.join(here, 'uploads', 'resumes'))
fs.mkdirSync(resumeDirectory, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, resumeDirectory),
  filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
})

export const resumeUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(['.pdf', '.doc', '.docx'])
    const extension = path.extname(file.originalname).toLowerCase()
    if (!allowed.has(extension)) return callback(new Error('Please upload a PDF, DOC or DOCX resume.'))
    callback(null, true)
  },
})