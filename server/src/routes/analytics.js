import express from 'express'
import { verifyToken, blockSuperAdmin } from '../middleware/auth.js'
import { allowRoles } from '../middleware/rbac.js'
import { overview, callStats, leadStats, sentimentTrend, agentPerf } from '../controllers/analyticsCtrl.js'

const router = express.Router()

router.use(verifyToken, blockSuperAdmin)

router.get('/overview', overview)
router.get('/calls', callStats)
router.get('/leads', leadStats)
router.get('/sentiment', sentimentTrend)
router.get('/agents', agentPerf)

export default router
