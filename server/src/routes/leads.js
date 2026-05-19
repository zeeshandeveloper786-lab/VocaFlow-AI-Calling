import express from 'express'
import { verifyToken, blockSuperAdmin } from '../middleware/auth.js'
import { allowRoles } from '../middleware/rbac.js'
import { getLeads, getOne, create, update, remove, bulkCreate, getScore, rescore, getHotLeads, getLeadDocuments } from '../controllers/leadCtrl.js'

const router = express.Router()

router.use(verifyToken, blockSuperAdmin)

router.get('/', getLeads)
router.get('/documents', getLeadDocuments)
router.post('/', create)
router.post('/bulk', allowRoles('TENANT_ADMIN'), bulkCreate)
router.get('/priority/hot', getHotLeads)
router.get('/:id', getOne)
router.get('/:id/score', getScore)
router.post('/:id/rescore', rescore)
router.put('/:id', update)
router.delete('/:id', remove)

export default router
