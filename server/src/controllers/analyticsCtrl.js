import prisma from '../lib/db.js'

export const getOverview = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId
    const whereCall = {
      tenantId,
      OR: [
        { leadId: null },
        { lead: { deletedAt: null } }
      ]
    }
    const totalCalls = await prisma.call.count({ where: whereCall })
    const missedCalls = await prisma.call.count({ where: { ...whereCall, status: "MISSED" } })
    const transferredCalls = await prisma.call.count({ where: { ...whereCall, status: "TRANSFERRED" } })
    const activeLeads = await prisma.lead.count({ where: { tenantId, deletedAt: null, status: { notIn: ["LOST", "CANCELLED"] } } })
    const qualifiedLeads = await prisma.lead.count({ where: { tenantId, deletedAt: null, status: "QUALIFIED" } })
    const bookedLeads = await prisma.lead.count({ where: { tenantId, deletedAt: null, status: "BOOKED" } })
    const conversionRate = activeLeads > 0 ? ((qualifiedLeads + bookedLeads) / activeLeads) * 100 : 0
    const totalAppointments = await prisma.appointment.count({ where: { tenantId } }).catch(() => 0)
    const bookingRate = activeLeads > 0 ? (bookedLeads / activeLeads) * 100 : 0
    const handoffRate = totalCalls > 0 ? (transferredCalls / totalCalls) * 100 : 0
    const callsWithDuration = await prisma.call.findMany({ where: { ...whereCall, duration: { not: null } }, select: { duration: true } })
    const avgDuration = callsWithDuration.length > 0 ? Math.round(callsWithDuration.reduce((sum, c) => sum + c.duration, 0) / callsWithDuration.length) : 0
    const callsWithObjections = await prisma.call.count({ where: { ...whereCall, sentiment: "NEGATIVE" } })
    const objectionRate = totalCalls > 0 ? (callsWithObjections / totalCalls) * 100 : 0
    const recentCalls = await prisma.call.findMany({
      where: whereCall,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { agent: true, lead: true }
    })
    return res.json({ success: true, data: { totalCalls, missedCalls, activeLeads, conversionRate, bookingRate, avgDuration, totalAppointments, handoffRate, objectionRate, recentCalls } })
  } catch (err) {
    next(err)
  }
}

export const getCalls = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const calls = await prisma.call.findMany({
      where: {
        tenantId,
        createdAt: { gte: sevenDaysAgo },
        OR: [
          { leadId: null },
          { lead: { deletedAt: null } }
        ]
      },
      select: { createdAt: true }
    })
    const dailyMap = {}
    calls.forEach(c => {
      const date = c.createdAt.toISOString().split('T')[0]
      dailyMap[date] = (dailyMap[date] || 0) + 1
    })
    const data = Object.entries(dailyMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export const getLeads = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId
    const data = await prisma.lead.groupBy({
      by: ["status"],
      where: { tenantId, deletedAt: null },
      _count: { id: true }
    })
    return res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export const getAgents = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId
    const agents = await prisma.agent.findMany({ where: { tenantId, deletedAt: null } })
    const result = []
    const whereCall = {
      tenantId,
      OR: [
        { leadId: null },
        { lead: { deletedAt: null } }
      ]
    }
    for (const agent of agents) {
      const callCount = await prisma.call.count({ where: { agentId: agent.id, ...whereCall } })
      const calls = await prisma.call.findMany({
        where: { agentId: agent.id, ...whereCall, sentimentScore: { not: null } },
        select: { sentimentScore: true }
      })
      const avgScore = calls.length > 0
        ? Math.round(calls.reduce((s, c) => s + c.sentimentScore, 0) / calls.length)
        : 0
      result.push({ agentId: agent.id, agentName: agent.name, callCount, avgScore })
    }
    return res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}

export const getSentiment = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const calls = await prisma.call.findMany({
      where: {
        tenantId,
        createdAt: { gte: thirtyDaysAgo },
        sentimentScore: { not: null },
        OR: [
          { leadId: null },
          { lead: { deletedAt: null } }
        ]
      },
      select: { createdAt: true, sentimentScore: true }
    })
    const dailyData = {}
    calls.forEach(c => {
      const date = c.createdAt.toISOString().split('T')[0]
      if (!dailyData[date]) {
        dailyData[date] = { total: 0, count: 0 }
      }
      dailyData[date].total += c.sentimentScore
      dailyData[date].count++
    })
    const trend = Object.entries(dailyData).map(([date, data]) => ({
      date,
      avgSentiment: Math.round((data.total / data.count) * 100)
    })).sort((a, b) => a.date.localeCompare(b.date))
    return res.json({ success: true, data: trend })
  } catch (err) {
    next(err)
  }
}

export const overview = getOverview
export const callStats = getCalls
export const leadStats = getLeads
export const agentPerf = getAgents
export const sentimentTrend = getSentiment
