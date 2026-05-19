import express from 'express'
import { verifyToken, blockSuperAdmin } from '../middleware/auth.js'
import { handleObjectionRoute } from '../controllers/objectionCtrl.js'

const router = express.Router()

router.use(verifyToken, blockSuperAdmin)

router.post('/handle', handleObjectionRoute)

export default router
