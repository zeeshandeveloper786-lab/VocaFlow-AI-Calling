import db from '../lib/db.js'

const getUserTenant = async (userId) => {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { tenantUsers: true }
    })
    if (!user || !user.tenantUsers.length) return null
    return user.tenantUsers[0].tenantId
  } catch (err) {
    console.error('getUserTenant error:', err)
    return null
  }
}

export const getDashboardStats = async (req, res, next) => {
  try {
    const totalUsers = await db.user.count()

    const agents = await db.agent.findMany({
      include: {
        tenant: {
          include: {
            tenantUsers: {
              include: {
                user: true
              }
            }
          }
        }
      }
    })

    const leads = await db.lead.findMany({
      include: {
        tenant: {
          include: {
            tenantUsers: {
              include: {
                user: true
              }
            }
          }
        }
      }
    })

    const totalCalls = await db.call.count()

    const agentsWithOwners = agents.map(agent => ({
      ...agent,
      owner: agent.tenant.tenantUsers[0]?.user
    }))

    const leadsWithOwners = leads.map(lead => ({
      ...lead,
      owner: lead.tenant.tenantUsers[0]?.user
    }))

    res.json({
      totalUsers,
      totalAgents: agents.length,
      agents: agentsWithOwners,
      totalLeads: leads.length,
      leads: leadsWithOwners,
      totalWorkflows: 0,
      workflows: [],
      totalCalls
    })
  } catch (err) {
    console.error('getDashboardStats error:', err)
    next(err)
  }
}

export const getAllUsers = async (req, res, next) => {
  try {
    const users = await db.user.findMany({
      include: {
        tenantUsers: {
          include: {
            tenant: {
              include: {
                _count: {
                  select: {
                    agents: true,
                    leads: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const formattedUsers = users.map(user => {
      const tenantUser = user.tenantUsers[0]
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: tenantUser?.role,
        joinDate: user.createdAt,
        totalAgents: tenantUser?.tenant?._count?.agents || 0,
        totalLeads: tenantUser?.tenant?._count?.leads || 0,
        totalWorkflows: 0
      }
    })

    res.json(formattedUsers)
  } catch (err) {
    console.error('getAllUsers error:', err)
    next(err)
  }
}

export const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' })
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: { tenantUsers: true }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const tenantIds = user.tenantUsers.map(tu => tu.tenantId)

    await db.$transaction(async (tx) => {
      for (const tenantId of tenantIds) {
        await tx.coachingReport.deleteMany({ where: { tenantId } })
        await tx.embedding.deleteMany({ where: { tenantId } })
        await tx.knowledgeDoc.deleteMany({ where: { tenantId } })
        await tx.appointment.deleteMany({ where: { tenantId } })
        await tx.call.deleteMany({ where: { tenantId } })
        await tx.lead.deleteMany({ where: { tenantId } })
        await tx.phoneNumber.deleteMany({ where: { tenantId } })
        await tx.agent.deleteMany({ where: { tenantId } })
        await tx.tenantUser.deleteMany({ where: { tenantId } })
        await tx.tenant.delete({ where: { id: tenantId } })
      }

      await tx.user.delete({ where: { id: userId } })
    })

    res.json({ success: true })
  } catch (err) {
    console.error('deleteUser error:', err)
    next(err)
  }
}

export const getUserOverview = async (req, res, next) => {
  try {
    const { userId } = req.params
    const tenantId = await getUserTenant(userId)
    if (!tenantId) return res.status(404).json({ error: 'User not found' })

    const user = await db.user.findUnique({ where: { id: userId } })
    const totalAgents = await db.agent.count({ where: { tenantId } })
    const totalLeads = await db.lead.count({ where: { tenantId } })
    const totalCalls = await db.call.count({ where: { tenantId } })
    const totalWorkflows = 0

    const recentCalls = await db.call.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { agent: true, lead: true }
    })

    const leadStatusBreakdown = await db.lead.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true }
    })

    res.json({
      user,
      totalAgents,
      totalLeads,
      totalCalls,
      totalWorkflows,
      recentCalls,
      leadStatusBreakdown
    })
  } catch (err) {
    console.error('getUserOverview error:', err)
    next(err)
  }
}

export const getUserAgents = async (req, res, next) => {
  try {
    const { userId } = req.params
    const tenantId = await getUserTenant(userId)
    if (!tenantId) return res.status(404).json({ error: 'User not found' })

    const agents = await db.agent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    })

    res.json(agents)
  } catch (err) {
    next(err)
  }
}

export const deleteUserAgent = async (req, res, next) => {
  try {
    const { userId, agentId } = req.params
    const tenantId = await getUserTenant(userId)
    if (!tenantId) return res.status(404).json({ error: 'User not found' })

    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent || agent.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Agent not found' })
    }

    await db.agent.delete({ where: { id: agentId } })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

export const getUserLeads = async (req, res, next) => {
  try {
    const { userId } = req.params
    const tenantId = await getUserTenant(userId)
    if (!tenantId) return res.status(404).json({ error: 'User not found' })

    const leads = await db.lead.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { agent: true }
    })

    res.json(leads)
  } catch (err) {
    next(err)
  }
}

export const deleteUserLead = async (req, res, next) => {
  try {
    const { userId, leadId } = req.params
    const tenantId = await getUserTenant(userId)
    if (!tenantId) return res.status(404).json({ error: 'User not found' })

    const lead = await db.lead.findUnique({ where: { id: leadId } })
    if (!lead || lead.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Lead not found' })
    }

    await db.lead.delete({ where: { id: leadId } })
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}

export const updateUserLeadStatus = async (req, res, next) => {
  try {
    const { userId, leadId } = req.params
    const { status } = req.body
    const tenantId = await getUserTenant(userId)
    if (!tenantId) return res.status(404).json({ error: 'User not found' })

    const lead = await db.lead.findUnique({ where: { id: leadId } })
    if (!lead || lead.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Lead not found' })
    }

    const updatedLead = await db.lead.update({
      where: { id: leadId },
      data: { status }
    })

    res.json(updatedLead)
  } catch (err) {
    next(err)
  }
}

export const getUserCalls = async (req, res, next) => {
  try {
    const { userId } = req.params
    const tenantId = await getUserTenant(userId)
    if (!tenantId) return res.status(404).json({ error: 'User not found' })

    const calls = await db.call.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { agent: true, lead: true }
    })

    res.json(calls)
  } catch (err) {
    next(err)
  }
}

export const getUserCallTranscript = async (req, res, next) => {
  try {
    const { userId, callId } = req.params
    const tenantId = await getUserTenant(userId)
    if (!tenantId) return res.status(404).json({ error: 'User not found' })

    const call = await db.call.findUnique({ where: { id: callId } })
    if (!call || call.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Call not found' })
    }

    res.json({ transcript: call.transcript })
  } catch (err) {
    next(err)
  }
}



