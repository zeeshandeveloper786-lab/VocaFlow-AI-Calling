import express from 'express'
import { verifyToken, blockSuperAdmin, requireRole } from '../middleware/auth.js'
import { getMe, updateMe, getPhoneNumbers, addPhoneNumber, deletePhoneNumber, linkAgentToNumber, assignTwilioNumber } from '../controllers/tenantCtrl.js'

const router = express.Router()

router.use(verifyToken, blockSuperAdmin)

router.get('/me', getMe)
router.get('/phone-numbers', getPhoneNumbers)
router.post('/phone-numbers', requireRole('TENANT_ADMIN'), addPhoneNumber)
router.delete('/phone-numbers/:id', requireRole('TENANT_ADMIN'), deletePhoneNumber)
router.put('/phone-numbers/:id/link-agent', requireRole('TENANT_ADMIN'), linkAgentToNumber)
router.put('/phone-numbers/assign', requireRole('TENANT_ADMIN'), assignTwilioNumber)
router.put('/me', requireRole('TENANT_ADMIN'), updateMe)

export default router
