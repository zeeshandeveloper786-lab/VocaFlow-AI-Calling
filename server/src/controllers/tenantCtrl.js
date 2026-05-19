import db from '../lib/db.js'

export const getMe = async (req, res, next) => {
  try {
    const tid = req.user?.tenantId
    if (!tid) return res.status(401).json({ error: 'no tenant' })
    
    const tenant = await db.tenant.findUnique({
      where: { id: tid }
    })

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' })
    }

    res.json(tenant)
  } catch (err) {
    next(err)
  }
}

export const updateMe = async (req, res, next) => {
  try {
    const { name } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Name is required' })
    }

    const tenant = await db.tenant.update({
      where: { id: req.user.tenantId },
      data: { name }
    })

    res.json(tenant)
  } catch (err) {
    next(err)
  }
}

export const getPhoneNumbers = async (req, res, next) => {
  try {
    const tid = req.user?.tenantId
    if (!tid) return res.status(401).json({ error: 'no tenant' })
    const inboundNumbers = await db.phoneNumber.findMany({
      where: { tenantId: tid, phoneType: "INBOUND" },
      include: { agent: true }
    })
    const transferNumbers = await db.phoneNumber.findMany({
      where: { tenantId: tid, phoneType: "TRANSFER" },
      include: { agent: true }
    })
    res.json({ success: true, data: { inboundNumbers, transferNumbers } })
  } catch (err) {
    next(err)
  }
}

export const addPhoneNumber = async (req, res, next) => {
  try {
    const tid = req.user?.tenantId
    if (!tid) return res.status(401).json({ error: 'no tenant' })
    const { number, label, agentId, phoneType } = req.body
    if (!number) return res.status(400).json({ error: 'number is required' })
    const phoneNumber = await db.phoneNumber.create({
      data: {
        tenantId: tid,
        number,
        label: label || '',
        agentId: agentId || null,
        phoneType: phoneType || "INBOUND"
      }
    })
    res.status(201).json(phoneNumber)
  } catch (err) {
    console.error('addPhoneNumber error:', err)
    next(err)
  }
}

export const deletePhoneNumber = async (req, res, next) => {
  try {
    const { id } = req.params
    const tid = req.user?.tenantId
    if (!tid) return res.status(401).json({ error: 'no tenant' })
    
    const phoneNumber = await db.phoneNumber.findFirst({
      where: { id, tenantId: tid }
    })
    
    if (!phoneNumber) {
      return res.status(404).json({ error: 'Phone number not found' })
    }
    
    await db.agent.updateMany({
      where: { transferPhoneId: id, tenantId: tid },
      data: { transferPhoneId: null }
    })
    
    await db.phoneNumber.delete({
      where: { id }
    })
    
    res.json({ success: true })
  } catch (err) {
    console.error('deletePhoneNumber error:', err)
    next(err)
  }
}

export const linkAgentToNumber = async (req, res, next) => {
  try {
    const { id } = req.params
    const { agentId } = req.body
    const tid = req.user?.tenantId
    if (!tid) return res.status(401).json({ error: 'no tenant' })
    
    const phoneNumber = await db.phoneNumber.findFirst({
      where: { id, tenantId: tid }
    })
    
    if (!phoneNumber) {
      return res.status(404).json({ error: 'Phone number not found' })
    }
    
    const updatedPhoneNumber = await db.phoneNumber.update({
      where: { id },
      data: { agentId: agentId || null },
      include: { agent: true }
    })
    
    res.json(updatedPhoneNumber)
  } catch (err) {
    console.error('linkAgentToNumber error:', err)
    next(err)
  }
}

export const assignTwilioNumber = async (req, res, next) => {
  try {
    const tid = req.user?.tenantId
    if (!tid) return res.status(401).json({ error: 'no tenant' })
    const { agentId } = req.body
    const number = process.env.TWILIO_PHONE_NUMBER
    if (!number) return res.status(400).json({ error: 'TWILIO_PHONE_NUMBER not set in .env' })

    const existing = await db.phoneNumber.findFirst({
      where: { tenantId: tid, number }
    })

    let phoneRecord
    if (existing) {
      phoneRecord = await db.phoneNumber.update({
        where: { id: existing.id },
        data: { agentId: agentId || null },
        include: { agent: true }
      })
    } else {
      phoneRecord = await db.phoneNumber.create({
        data: { tenantId: tid, number, agentId: agentId || null, phoneType: 'INBOUND' },
        include: { agent: true }
      })
    }

    res.json({ success: true, data: phoneRecord })
  } catch (err) {
    console.error('assignTwilioNumber error:', err)
    next(err)
  }
}
