import express from 'express'
import { verifyToken, blockSuperAdmin, requireRole } from '../middleware/auth.js'
import { list } from '../controllers/callsCtrl.js'
import { transferCall } from '../controllers/handoffCtrl.js'

const router = express.Router()

router.use(verifyToken, blockSuperAdmin)

router.get('/', requireRole('TENANT_ADMIN'), list)
router.post('/:id/transfer', requireRole('TENANT_ADMIN'), transferCall)
router.post('/handoff', transferCall)

export default router
