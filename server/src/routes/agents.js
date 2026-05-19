import express from 'express'
import { verifyToken, blockSuperAdmin } from '../middleware/auth.js'
import { allowRoles } from '../middleware/rbac.js'
import { list, create, getOne, update, remove, getAgentDocuments } from '../controllers/agentCtrl.js'

const router = express.Router()

router.use(verifyToken, blockSuperAdmin)

router.get('/', list)
router.get('/documents', getAgentDocuments)
router.post('/', allowRoles('TENANT_ADMIN'), create)
router.get('/:id', getOne)
router.put('/:id', allowRoles('TENANT_ADMIN'), update)
router.delete('/:id', allowRoles('TENANT_ADMIN'), remove)

export default router
