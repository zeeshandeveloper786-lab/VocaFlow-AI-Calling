import express from 'express'
import { verifyToken, blockSuperAdmin, requireRole } from '../middleware/auth.js'
import db from '../lib/db.js'
import { getAuthUrl, handleCallback, getSlots, bookSlot } from '../lib/gcal.js'
import { rescheduleAppointment, cancelAppointment } from '../controllers/appointmentCtrl.js'

const router = express.Router()

router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query
    const { tenantId } = JSON.parse(Buffer.from(state, 'base64').toString())
    await handleCallback(code, tenantId)
    // Redirect to frontend settings page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    res.redirect(`${frontendUrl}/settings?tab=calendar&connected=true`)
  } catch (err) {
    console.error('Calendar callback error:', err)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    res.redirect(`${frontendUrl}/settings?tab=calendar&error=auth_failed`)
  }
})

router.use(verifyToken, blockSuperAdmin)

router.get('/auth', requireRole('TENANT_ADMIN'), (req, res) => {
  const url = getAuthUrl(req.user.tenantId)
  res.json({ url })
})

router.get('/status', async (req, res) => {
  try {
    const tenant = await db.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: { googleCalendarId: true }
    })
    res.json({ connected: !!tenant?.googleCalendarId })
  } catch (err) {
    res.status(500).json({ error: 'Failed to get calendar status' })
  }
})

router.post('/disconnect', requireRole('TENANT_ADMIN'), async (req, res) => {
  try {
    await db.tenant.update({
      where: { id: req.user.tenantId },
      data: {
        googleAccessToken: null,
        googleRefreshToken: null,
        googleCalendarId: null
      }
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect calendar' })
  }
})

router.get('/slots', async (req, res) => {
  try {
    const { date } = req.query
    const slots = await getSlots(req.user.tenantId, date)
    res.json(slots)
  } catch (err) {
    res.status(500).json({ error: 'Failed to get slots' })
  }
})

router.post('/book', async (req, res) => {
  try {
    const { slot, leadName, leadPhone } = req.body
    const result = await bookSlot(req.user.tenantId, slot, leadName, leadPhone)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Failed to book slot' })
  }
})

router.put('/appointments/:id', rescheduleAppointment)
router.delete('/appointments/:id', cancelAppointment)

export default router
