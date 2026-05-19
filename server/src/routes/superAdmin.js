import express from 'express'
import { verifyToken, requireRole } from '../middleware/auth.js'
import { 
  getDashboardStats, 
  getAllUsers, 
  deleteUser,
  getUserOverview,
  getUserAgents,
  deleteUserAgent,
  getUserLeads,
  deleteUserLead,
  updateUserLeadStatus,
  getUserCalls,
  getUserCallTranscript
} from '../controllers/superAdminCtrl.js'

const router = express.Router()

router.use(verifyToken)
router.use(requireRole('SUPER_ADMIN'))

router.get('/stats', getDashboardStats)
router.get('/users', getAllUsers)
router.delete('/users/:userId', deleteUser)

router.get('/users/:userId/overview', getUserOverview)
router.get('/users/:userId/agents', getUserAgents)
router.delete('/users/:userId/agents/:agentId', deleteUserAgent)
router.get('/users/:userId/leads', getUserLeads)
router.delete('/users/:userId/leads/:leadId', deleteUserLead)
router.patch('/users/:userId/leads/:leadId/status', updateUserLeadStatus)
router.get('/users/:userId/calls', getUserCalls)
router.get('/users/:userId/calls/:callId/transcript', getUserCallTranscript)

export default router
