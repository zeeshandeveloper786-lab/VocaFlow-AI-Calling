import express from 'express'
import { verifyToken, blockSuperAdmin } from '../middleware/auth.js'
import { allowRoles } from '../middleware/rbac.js'
import { startDialer, stopDialer, getStatus } from '../controllers/dialerCtrl.js'

const router = express.Router()

router.use(verifyToken, blockSuperAdmin)

router.post('/start', allowRoles('TENANT_ADMIN'), startDialer)
router.post('/stop', stopDialer)
router.get('/status', getStatus)

export default router
