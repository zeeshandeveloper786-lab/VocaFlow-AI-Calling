import express from 'express'
import { verifyToken } from '../middleware/auth.js'
import { allowRoles } from '../middleware/rbac.js'
import { getProfile, allTenants, tenantDetail, updateTenant, deleteTenant, updateSuperAdmin, stats } from '../controllers/adminCtrl.js'

const router = express.Router()

router.get('/profile', verifyToken, allowRoles('SUPER_ADMIN'), getProfile)
router.get('/stats', verifyToken, allowRoles('SUPER_ADMIN'), stats)
router.get('/tenants', verifyToken, allowRoles('SUPER_ADMIN'), allTenants)
router.get('/tenants/:id', verifyToken, allowRoles('SUPER_ADMIN'), tenantDetail)
router.put('/tenants/:id', verifyToken, allowRoles('SUPER_ADMIN'), updateTenant)
router.delete('/tenants/:id', verifyToken, allowRoles('SUPER_ADMIN'), deleteTenant)
router.put('/profile', verifyToken, allowRoles('SUPER_ADMIN'), updateSuperAdmin)

export default router
