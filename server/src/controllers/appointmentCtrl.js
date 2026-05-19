import prisma from '../lib/db.js'
import { updateEvent, deleteEvent } from '../lib/gcal.js'

export const rescheduleAppointment = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId
    const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } })
    if (appointment.calendarEventId) await updateEvent(tenantId, appointment.calendarEventId, req.body.startTime, req.body.endTime)
    const updated = await prisma.appointment.update({ where: { id: req.params.id }, data: { scheduledAt: new Date(req.body.startTime) } })
    return res.json({ success: true, data: updated })
  } catch (err) {
    next(err)
  }
}

export const cancelAppointment = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId
    const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } })
    if (appointment.calendarEventId) await deleteEvent(tenantId, appointment.calendarEventId)
    await prisma.appointment.update({ where: { id: req.params.id }, data: { status: "CANCELLED" } })
    return res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
