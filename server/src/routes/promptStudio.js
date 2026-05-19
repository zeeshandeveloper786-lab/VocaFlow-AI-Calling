import express from 'express'
import { verifyToken, blockSuperAdmin } from '../middleware/auth.js'
import { getPrompts, savePrompts, testPrompt } from '../controllers/promptStudioCtrl.js'

const router = express.Router()

router.use(verifyToken, blockSuperAdmin)

router.get('/:agentId', getPrompts)
router.put('/:agentId', savePrompts)
router.post('/test', testPrompt)

export default router
