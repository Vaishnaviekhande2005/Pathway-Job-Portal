import jwt from 'jsonwebtoken'
import { User } from './models.js'

export async function requireAuth(req, res, next) {
  let payload
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' })
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' })
  }
  try {
    const user = await User.findById(payload.sub)
    if (!user || user.disabled) return res.status(401).json({ message: 'This account is unavailable.' })
    req.user = user
    return next()
  } catch (error) {
    return next(error)
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'You do not have permission to do that.' })
}