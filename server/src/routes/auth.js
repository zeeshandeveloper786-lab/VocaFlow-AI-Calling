import express from 'express'
import { register, login, refresh, logout, changePassword } from '../controllers/authCtrl.js'
import { verifyToken } from '../middleware/auth.js'
import { rateLimiter } from '../middleware/rateLimiter.js'

const router = express.Router()

// Allow up to 20 attempts per minute for registration and login
const authLimiter = rateLimiter({ windowMs: 60 * 1000, max: 20, message: 'Too many auth attempts. Please try again in a minute.' })

router.post('/register', authLimiter, register)
router.post('/login', authLimiter, login)
router.post('/refresh', refresh)
router.post('/logout', logout)
router.post('/change-password', verifyToken, rateLimiter({ windowMs: 60 * 1000, max: 10 }), changePassword)

export default router
