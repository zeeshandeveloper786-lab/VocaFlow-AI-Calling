import db from '../lib/db.js'
import { chat } from '../lib/llm.js'
import { initiateHandoff } from '../lib/handoff.js'

export const transferCall = async (req, res, next) => {
  try {
    const tid = req.user?.tenantId
    if (!tid) return res.status(401).json({ error: 'no tenant' })
    const { callSid, callId, reason } = req.body

    if (!callId) {
      return res.status(400).json({ error: 'callId is required' })
    }

    const call = await db.call.findUnique({
      where: { id: callId },
      include: { lead: true }
    })

    if (!call || call.tenantId !== tid) {
      return res.status(404).json({ error: 'Call not found' })
    }

    // Resolve transfer number
    const agent = call.agentId 
      ? await db.agent.findUnique({ 
          where: { id: call.agentId }, 
          include: { transferPhoneNumber: true } 
        }) 
      : null

    const transferPhone = agent?.transferPhoneNumber?.number || process.env.HUMAN_AGENT_NUMBER

    if (!transferPhone) {
      return res.status(400).json({ error: 'No transfer number configured' })
    }

    const systemPrompt = 'Summarize this call transcript in 2-3 sentences.'
    const summary = await chat(systemPrompt, `Transcript: ${call.transcript || ''}`).catch(() => '')

    // Correct signature: initiateHandoff(transferPhone, callSid, tenantId)
    try {
      await initiateHandoff(transferPhone, callSid || call.twilioSid, tid)
      res.json({ success: true, summary: summary || reason })
    } catch (handoffErr) {
      console.error('Handoff failed:', handoffErr)
      res.status(500).json({ error: handoffErr.message || 'Failed to transfer call to human agent' })
    }
  } catch (err) {
    next(err)
  }
}
