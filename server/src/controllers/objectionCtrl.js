import db from '../lib/db.js'
import { handleObjection } from '../lib/objections.js'

export const handleObjectionRoute = async (req, res, next) => {
  try {
    const tid = req.user?.tenantId
    if (!tid) return res.status(401).json({ error: 'no tenant' })
    const { transcript, agentId, callId } = req.body

    const result = await handleObjection(transcript, tid)

    if (callId) {
      const call = await db.call.findUnique({
        where: { id: callId },
        include: { lead: true }
      })
      if (call && call.tenantId === tid) {
        let analysis = {}
        if (call.analysis) {
          try {
            analysis = JSON.parse(call.analysis)
          } catch (e) {
            analysis = {}
          }
        }
        analysis.objection = result
        await db.call.update({
          where: { id: callId },
          data: { analysis: JSON.stringify(analysis) }
        })
      }
    }

    res.json(result)
  } catch (err) {
    next(err)
  }
}
