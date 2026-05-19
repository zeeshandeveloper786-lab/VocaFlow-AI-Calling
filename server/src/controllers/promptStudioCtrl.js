
import db from '../lib/db.js'
import { chat, generateReply } from '../lib/llm.js'

export const getPrompts = async (req, res, next) => {
  try {
    const tid = req.user?.tenantId
    if (!tid) return res.status(401).json({ error: 'no tenant' })
    const { agentId } = req.params
    const agent = await db.agent.findFirst({
      where: { id: agentId, tenantId: tid, deletedAt: null }
    })
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    res.json({
      systemPrompt: agent.systemPrompt
    })
  } catch (err) {
    next(err)
  }
}

export const savePrompts = async (req, res, next) => {
  try {
    const tid = req.user?.tenantId
    if (!tid) return res.status(401).json({ error: 'no tenant' })
    const { agentId } = req.params
    const { systemPrompt } = req.body
    const agent = await db.agent.findFirst({
      where: { id: agentId, tenantId: tid, deletedAt: null }
    })
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    const updated = await db.agent.update({
      where: { id: agentId },
      data: {
        systemPrompt
      }
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
}

export const testPrompt = async (req, res, next) => {
  try {
    const { systemPrompt, testMessage, chatHistory } = req.body
    let response
    if (chatHistory && Array.isArray(chatHistory)) {
      response = await generateReply(systemPrompt, chatHistory, testMessage)
    } else {
      response = await chat(systemPrompt, testMessage)
    }
    res.json({ response })
  } catch (err) {
    next(err)
  }
}
