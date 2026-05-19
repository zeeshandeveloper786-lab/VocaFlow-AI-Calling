import redis from "../lib/redis.js"
import prisma from "../lib/db.js"

export const startDialer = async (req, res, next) => {
  try {
    const { agentId } = req.body
    const tenantId = req.user.tenantId
    const leads = await prisma.lead.findMany({ where: { tenantId, status: "PENDING" } })
    const { default: queue } = await import("../lib/queue.js")
    for (const lead of leads) { await queue.add("outbound-call", { leadId: lead.id, tenantId, agentId }) }
    await redis.set("dialer:" + tenantId, "running")
    return res.json({ success: true, data: { queued: leads.length } })
  } catch (err) {
    next(err)
  }
}

export const stopDialer = async (req, res, next) => {
  try {
    const { default: queue } = await import("../lib/queue.js")
    await queue.drain()
    await redis.set("dialer:" + req.user.tenantId, "stopped")
    return res.json({ success: true, data: { stopped: true } })
  } catch (err) {
    next(err)
  }
}

export const getStatus = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId
    const status = await redis.get("dialer:" + tenantId)
    
    let activeJobs = 0
    let waitingJobs = 0
    
    try {
      const { default: queue } = await import("../lib/queue.js")
      const [activeCount, waitingCount] = await Promise.all([
        queue.getActiveCount(),
        queue.getWaitingCount()
      ])
      activeJobs = activeCount
      waitingJobs = waitingCount
    } catch (err) {
      console.error("Failed to fetch queue job counts:", err)
    }

    return res.json({ 
      success: true, 
      data: { 
        status: status || "idle",
        activeJobs,
        waitingJobs
      } 
    })
  } catch (err) {
    next(err)
  }
}

