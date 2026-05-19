import { z } from 'zod'
import prisma from '../lib/db.js'
import { scoreCall } from '../lib/scorer.js'

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().optional(),
  agentId: z.string().uuid().optional(),
  knowledgeDocId: z.string().uuid().optional().nullable()
})

const updateSchema = createSchema.partial().extend({
  status: z.enum(['PENDING', 'CONTACTED', 'QUALIFIED', 'BOOKED', 'LOST']).optional(),
  score: z.number().optional()
})

export const getLeads = async (req, res, next) => {
  try {
    const { status, agentId, page = 1, limit = 20 } = req.query
    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const skip = (pageNum - 1) * limitNum

    const tid = req.user?.tenantId
    if (!tid) return res.status(401).json({ error: 'no tenant' })

    const where = {
      tenantId: tid,
      deletedAt: null
    }

    if (status) where.status = status
    if (agentId) where.agentId = agentId

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: { 
          calls: { orderBy: { createdAt: 'desc' }, take: 1 }, 
          _count: { select: { calls: true } }
        }
      }),
      prisma.lead.count({ where })
    ])

    res.json({ success: true, data: leads, total, page: pageNum, limit: limitNum })
  } catch (err) {
    console.error('getLeads error:', err)
    next(err)
  }
}

export const getOne = async (req, res, next) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id }
    })

    if (!lead || lead.tenantId !== req.user.tenantId || lead.deletedAt) {
      return res.status(404).json({ error: 'Lead not found' })
    }

    res.json(lead)
  } catch (err) {
    next(err)
  }
}

export const getLeadDocuments = async (req, res, next) => {
  try {
    const tid = req.user?.tenantId
    if (!tid) return res.status(401).json({ error: 'no tenant' })

    const docs = await prisma.knowledgeDoc.findMany({
      where: { tenantId: tid },
      orderBy: { createdAt: 'desc' }
    })

    res.json(docs)
  } catch (err) {
    next(err)
  }
}

export const create = async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body)
    const lead = await prisma.lead.create({
      data: {
        ...data,
        tenantId: req.user.tenantId
      }
    })
    res.status(201).json(lead)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues })
    }
    next(err)
  }
}

export const update = async (req, res, next) => {
  try {
    console.log('updateLead body:', req.body)
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id }
    })

    if (!lead || lead.tenantId !== req.user.tenantId || lead.deletedAt) {
      return res.status(404).json({ error: 'Lead not found' })
    }

    const data = updateSchema.parse(req.body)
    const updatedLead = await prisma.lead.update({
      where: { id: req.params.id },
      data
    })
    console.log('updateLead result:', updatedLead)
    res.json({ success: true, data: updatedLead })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues })
    }
    next(err)
  }
}

export const remove = async (req, res, next) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id }
    })

    if (!lead || lead.tenantId !== req.user.tenantId || lead.deletedAt) {
      return res.status(404).json({ error: 'Lead not found' })
    }

    const updated = await prisma.lead.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() }
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
}

export const bulkCreate = async (req, res, next) => {
  try {
    const leads = req.body.leads
    if (!Array.isArray(leads)) return res.status(400).json({ success: false, message: "leads must be array" })
    
    // Protect against oversized arrays (cap at 5000)
    if (leads.length > 5000) {
      return res.status(400).json({ success: false, message: "Maximum 5000 leads allowed per batch" })
    }

    const sanitizeVal = (val) => {
      if (typeof val !== 'string') return val
      let clean = val.trim()
      // Block CSV Formula Injection
      if (clean.startsWith('=') || clean.startsWith('+') || clean.startsWith('-') || clean.startsWith('@')) {
        clean = clean.replace(/^[=\+\-@]+/, '')
      }
      return clean
    }

    const sanitizePhone = (phone) => {
      if (typeof phone !== 'string') return ''
      let clean = phone.replace(/[^\d+]/g, '')
      if (clean.startsWith('03')) {
        clean = '92' + clean.slice(1)
      } else if (clean.startsWith('3') && clean.length === 10) {
        clean = '92' + clean
      } else if (clean.startsWith('92') && !clean.startsWith('+')) {
        clean = '+' + clean
      } else if (!clean.startsWith('+')) {
        clean = '+' + clean
      }
      return clean
    }

    const sanitizedLeads = leads
      .filter(l => l && l.name && l.phone)
      .map(l => ({
        name: sanitizeVal(l.name),
        phone: sanitizePhone(l.phone),
        email: l.email ? sanitizeVal(l.email) : null,
        notes: l.notes ? sanitizeVal(l.notes) : null,
        tenantId: req.user.tenantId
      }))

    await prisma.lead.createMany({ 
      data: sanitizedLeads, 
      skipDuplicates: true 
    })
    
    return res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

export const getScore = async (req, res, next) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } })
    if (!lead || lead.tenantId !== req.user.tenantId || lead.deletedAt) {
      return res.status(404).json({ error: 'Lead not found' })
    }
    const calls = await prisma.call.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
      take: 1
    })
    res.json({ lead, latestCall: calls[0] })
  } catch (err) {
    next(err)
  }
}

export const rescore = async (req, res, next) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } })
    if (!lead || lead.tenantId !== req.user.tenantId || lead.deletedAt) {
      return res.status(404).json({ error: 'Lead not found' })
    }
    const calls = await prisma.call.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
      take: 1
    })
    if (calls[0]) {
      scoreCall(calls[0].transcript, lead.id, req.user.tenantId, calls[0].id)
    }
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

export const getHotLeads = async (req, res, next) => {
  try {
    const leads = await prisma.lead.findMany({
      where: { tenantId: req.user.tenantId, deletedAt: null, OR: [{ score: { gte: 70 } }, { status: { in: ["QUALIFIED","BOOKED"] } }] },
      orderBy: { createdAt: 'desc' }
    })
    res.json(leads)
  } catch (err) {
    next(err)
  }
}
