import prisma from "../lib/db.js"
import { Worker } from 'bullmq'
import redis from '../lib/redis.js'
import { twilioClient } from '../lib/twilio.js'

import { getIO } from '../lib/socket.js'

async function handleCallFailure(lead, tenantId, agentId, errorMessage) {
  try {
    await prisma.call.create({
      data: {
        tenantId,
        agentId: agentId || "",
        leadId: lead.id,
        direction: "OUTBOUND",
        status: "FAILED",
        transcript: `Failed to initiate call via Twilio: ${errorMessage}`
      }
    })

    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: "FAILED" }
    })

    try {
      getIO().to(tenantId).emit('dialer_job_status', {
        status: 'failed',
        leadId: lead.id,
        name: lead.name,
        phone: lead.phone,
        error: errorMessage
      })
    } catch (e) {
      console.error("Failed to emit socket error:", e.message)
    }
  } catch (err) {
    console.error("Error executing handleCallFailure helper:", err)
  }
}

let callWorker
try {
  callWorker = new Worker('calls', async (job) => {
    if (job.name === 'outbound-call') {
      const { leadId, tenantId, agentId } = job.data

      const lead = await prisma.lead.findUnique({ where: { id: leadId } })
      const agent = agentId ? await prisma.agent.findUnique({ where: { id: agentId } }) : null

      if (!lead || lead.deletedAt) return

      try {
        getIO().to(tenantId).emit('dialer_job_status', {
          status: 'calling',
          leadId,
          name: lead.name,
          phone: lead.phone
        })
      } catch (e) {
        console.error("Failed to emit socket calling:", e.message)
      }

      if (!process.env.TWILIO_PHONE_NUMBER) {
        const errMsg = 'TWILIO_PHONE_NUMBER not set in env'
        await handleCallFailure(lead, tenantId, agentId, errMsg)
        return
      }
      if (!lead.phone) {
        const errMsg = 'Lead has no phone number'
        await handleCallFailure(lead, tenantId, agentId, errMsg)
        return
      }

      try {
        const twilioCall = await twilioClient.calls.create({
          to: lead.phone,
          from: process.env.TWILIO_PHONE_NUMBER,
          url: process.env.SERVER_URL + "/webhooks/twilio/outbound-handler",
          statusCallback: process.env.SERVER_URL + "/webhooks/twilio/status",
          statusCallbackEvent: ['completed', 'failed', 'busy', 'no-answer']
        })

        const call = await prisma.call.create({
          data: { tenantId, agentId: agentId || "", leadId, direction: "OUTBOUND", status: "INITIATED", twilioSid: twilioCall.sid }
        })
        await redis.set("call:" + twilioCall.sid, JSON.stringify({
          callId: call.id, agentId, tenantId, leadId: lead.id,
          knowledgeDocId: agent?.knowledgeDocId || lead.knowledgeDocId
        }))
        await prisma.lead.update({ where: { id: leadId }, data: { status: "CONTACTED" } })

        try {
          getIO().to(tenantId).emit('dialer_job_status', {
            status: 'initiated',
            leadId,
            name: lead.name,
            phone: lead.phone,
            twilioSid: twilioCall.sid
          })
        } catch (e) {
          console.error("Failed to emit socket initiated:", e.message)
        }
      } catch (err) {
        console.error(`[Worker] Outbound call to ${lead.phone} failed:`, err)
        await handleCallFailure(lead, tenantId, agentId, err.message || String(err))
      }
    }
  }, { connection: redis })
} catch (err) {
  console.error('Failed to create call worker:', err)
  callWorker = null
}


export { callWorker }
