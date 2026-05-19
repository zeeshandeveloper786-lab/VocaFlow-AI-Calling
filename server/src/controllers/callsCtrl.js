import db from '../lib/db.js'
import { twilioClient } from '../lib/twilio.js'
import { getIO } from '../lib/socket.js'

export const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, direction, sentiment, fromDate } = req.query
    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const skip = (pageNum - 1) * limitNum

    const tid = req.user?.tenantId
    if (!tid) return res.status(401).json({ error: 'no tenant' })

    const where = {
      tenantId: tid,
      AND: [
        {
          OR: [
            { leadId: null },
            { lead: { deletedAt: null } }
          ]
        }
      ]
    }

    if (direction) {
      where.direction = direction.toUpperCase()
    }

    if (sentiment) {
      const s = sentiment.toUpperCase()
      if (s === 'POSITIVE') {
        where.AND.push({
          OR: [
            { sentiment: 'POSITIVE' },
            {
              AND: [
                { sentiment: null },
                { sentimentScore: { gt: 60 } }
              ]
            }
          ]
        })
      } else if (s === 'NEGATIVE') {
        where.AND.push({
          OR: [
            { sentiment: 'NEGATIVE' },
            {
              AND: [
                { sentiment: null },
                { sentimentScore: { lt: 40 } }
              ]
            }
          ]
        })
      } else if (s === 'NEUTRAL') {
        where.AND.push({
          OR: [
            { sentiment: 'NEUTRAL' },
            {
              AND: [
                { sentiment: null },
                { sentimentScore: { gte: 40, lte: 60 } }
              ]
            }
          ]
        })
      }
    }

    if (fromDate) {
      const date = new Date(fromDate)
      if (!isNaN(date.getTime())) {
        where.AND.push({
          createdAt: { gte: date }
        })
      }
    }

    const [calls, total] = await Promise.all([
      db.call.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: { lead: true, agent: true }
      }),
      db.call.count({ where })
    ])

    res.json({ data: calls, total, page: pageNum, limit: limitNum })
  } catch (err) {
    next(err)
  }
}

export const transferCall = async (req, res, next) => {
  try {
    const { id } = req.params
    const { number } = req.body

    const call = await db.call.findFirst({
      where: { id, tenantId: req.user.tenantId }
    })

    if (!call) {
      return res.status(404).json({ error: 'Call not found' })
    }

    const agent = call.agentId ? await db.agent.findUnique({ where: { id: call.agentId }, include: { transferPhoneNumber: true } }) : null
    const humanNumber = number || agent?.transferPhoneNumber?.number

    if (!humanNumber) {
      return res.status(400).json({ error: 'No transfer number configured for this agent' })
    }

    await twilioClient.calls(call.twilioSid).update({
      twiml: `<Response><Dial>${humanNumber}</Dial></Response>`
    })

    await db.call.update({
      where: { id },
      data: { status: 'transferred' }
    })

    const io = getIO()
    if (io) {
      io.to(`tenant-${req.user.tenantId}`).emit('call_transferred', {
        callId: call.id,
        transferredTo: humanNumber
      })
    }

    res.json({ success: true, transferredTo: humanNumber })
  } catch (err) {
    console.error('Transfer error:', err)
    next(err)
  }
}
