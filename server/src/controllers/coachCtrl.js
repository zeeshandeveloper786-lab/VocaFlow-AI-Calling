import db from '../lib/db.js'

export const listReports = async (req, res, next) => {
  try {
    const tid = req.user?.tenantId
    if (!tid) return res.status(401).json({ error: 'no tenant' })
    const { page = 1, limit = 20 } = req.query
    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const skip = (pageNum - 1) * limitNum

    const [reports, total] = await Promise.all([
      db.coachingReport.findMany({
        where: { tenantId: tid },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: { call: true, agent: true }
      }),
      db.coachingReport.count({ where: { tenantId: tid } })
    ])

    res.json({ data: reports, total, page: pageNum, limit: limitNum })
  } catch (err) {
    next(err)
  }
}

export const getReportByCallId = async (req, res, next) => {
  try {
    const tid = req.user?.tenantId
    if (!tid) return res.status(401).json({ error: 'no tenant' })
    const { callId } = req.params

    const report = await db.coachingReport.findFirst({
      where: { callId, tenantId: tid },
      include: { call: true, agent: true }
    })

    if (!report) return res.status(404).json({ error: 'Report not found' })

    res.json(report)
  } catch (err) {
    next(err)
  }
}

export const getWeeklyDigest = async (req, res, next) => {
  try {
    const tid = req.user?.tenantId
    if (!tid) return res.status(401).json({ error: 'no tenant' })
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const reports = await db.coachingReport.findMany({
      where: { tenantId: tid, createdAt: { gte: sevenDaysAgo } },
      include: { agent: true }
    })

    const grouped = {}
    reports.forEach(report => {
      const agentId = report.agentId
      if (!grouped[agentId]) {
        grouped[agentId] = {
          agentId,
          agentName: report.agent?.name || 'Unknown',
          mistakesCount: 0,
          insights: []
        }
      }
      if (Array.isArray(report.mistakes)) {
        grouped[agentId].mistakesCount += report.mistakes.length
      }
      if (report.insights) {
        grouped[agentId].insights.push(report.insights)
      }
    })

    res.json(Object.values(grouped))
  } catch (err) {
    next(err)
  }
}
