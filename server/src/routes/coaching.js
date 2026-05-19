import express from 'express'
import { verifyToken, blockSuperAdmin } from '../middleware/auth.js'
import { listReports, getReportByCallId, getWeeklyDigest } from '../controllers/coachCtrl.js'

const router = express.Router()

router.use(verifyToken, blockSuperAdmin)

router.get('/reports', listReports)
router.get('/reports/:callId', getReportByCallId)
router.get('/digest', getWeeklyDigest)

export default router
