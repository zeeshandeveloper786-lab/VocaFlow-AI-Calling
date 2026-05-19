import express from 'express'
import authRouter from './auth.js'
import tenantRouter from './tenant.js'
import agentsRouter from './agents.js'
import leadsRouter from './leads.js'
import callsRouter from './calls.js'
import uploadRouter from './upload.js'
import dialerRouter from './dialer.js'
import calendarRouter from './calendar.js'
import analyticsRouter from './analytics.js'
import adminRouter from './admin.js'
import coachingRouter from './coaching.js'
import objectionsRouter from './objections.js'
import promptStudioRouter from './promptStudio.js'
import superAdminRouter from './superAdmin.js'

const router = express.Router()

router.use('/auth', authRouter)
router.use('/super-admin', superAdminRouter)
router.use('/tenant', tenantRouter)
router.use('/agents', agentsRouter)
router.use('/leads', leadsRouter)
router.use('/calls', callsRouter)
router.use('/upload', uploadRouter)
router.use('/dialer', dialerRouter)
router.use('/calendar', calendarRouter)
router.use('/analytics', analyticsRouter)
router.use('/admin', adminRouter)
router.use('/coaching', coachingRouter)
router.use('/objections', objectionsRouter)
router.use('/prompt-studio', promptStudioRouter)

export default router
