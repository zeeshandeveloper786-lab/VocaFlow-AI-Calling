
import { z } from 'zod'
import db from '../lib/db.js'

const createSchema = z.object({
  name: z.string(),
  personality: z.string(),
  tone: z.string(),
  voiceId: z.string().optional().default(''),
  language: z.string(),
  industry: z.string().optional().default(''),
  agentType: z.string().optional().default('RECEPTIONIST'),
  systemPrompt: z.string().optional().default(''),
  knowledgeDocId: z.string().uuid().optional().nullable(),
  transferPhoneId: z.string().uuid().optional().nullable()
})

const updateSchema = createSchema.partial()

export const list = async (req, res, next) => {
  try {
    console.log('AGENT QUERY tenantId:', req.user?.tenantId)
    const tid = req.user?.tenantId
    if (!tid) return res.status(401).json({ error: 'no tenant' })
    const agents = await db.agent.findMany({
      where: {
        tenantId: tid,
        deletedAt: null
      },
      include: { knowledgeDoc: true, transferPhoneNumber: true }
    })
    res.json(agents)
  } catch (err) {
      next(err)
  }
}

export const create = async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body)
    const agent = await db.agent.create({
      data: { ...data, tenantId: req.user.tenantId },
      include: { knowledgeDoc: true, transferPhoneNumber: true }
    })
    res.status(201).json(agent)
  } catch (err) {
    console.error('create agent error:', err)
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues })
    }
    next(err)
  }
}

export const getOne = async (req, res, next) => {
  try {
    const agent = await db.agent.findUnique({
      where: { id: req.params.id },
      include: { knowledgeDoc: true, transferPhoneNumber: true }
    })

    if (!agent || agent.tenantId !== req.user.tenantId || agent.deletedAt) {
      return res.status(404).json({ error: 'Agent not found' })
    }

    res.json(agent)
  } catch (err) {
      next(err)
  }
}

export const update = async (req, res, next) => {
  try {
    const agent = await db.agent.findUnique({
      where: { id: req.params.id }
    })

    if (!agent || agent.tenantId !== req.user.tenantId || agent.deletedAt) {
      return res.status(404).json({ error: 'Agent not found' })
    }

    const data = updateSchema.parse(req.body)
    const updated = await db.agent.update({
      where: { id: req.params.id },
      data,
      include: { knowledgeDoc: true, transferPhoneNumber: true }
    })
    res.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues })
    }
    next(err)
  }
}

export const remove = async (req, res, next) => {
  try {
    const agent = await db.agent.findUnique({
      where: { id: req.params.id }
    })

    if (!agent || agent.tenantId !== req.user.tenantId || agent.deletedAt) {
      return res.status(404).json({ error: 'Agent not found' })
    }

    const updated = await db.agent.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() }
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
}

export const getAgentDocuments = async (req, res, next) => {
  try {
    const tid = req.user?.tenantId
    console.log('getAgentDocuments - tenantId:', tid)
    if (!tid) return res.status(401).json({ error: 'no tenant' })

    const docs = await db.knowledgeDoc.findMany({
      where: { tenantId: tid },
      orderBy: { createdAt: 'desc' }
    })
    console.log('getAgentDocuments - found docs:', docs.length, docs)

    res.json(docs)
  } catch (err) {
    console.error('getAgentDocuments error:', err)
    next(err)
  }
}
