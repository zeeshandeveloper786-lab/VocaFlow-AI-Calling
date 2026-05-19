import '../env.js'
import jwt from 'jsonwebtoken'

export const signAccess = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' })
}
export const signRefresh = (payload) => jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' })
export const verifyAccess = (token) => jwt.verify(token, process.env.JWT_SECRET)
export const verifyRefresh = (token) => jwt.verify(token, process.env.JWT_REFRESH_SECRET)