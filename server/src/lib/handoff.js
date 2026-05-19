import pkg from "twilio"
import { getIO } from "./socket.js"
import prisma from "./db.js"
import { twilioClient } from "./twilio.js"
const { twiml: { VoiceResponse } } = pkg

export async function initiateHandoff(transferPhone, callSid, tenantId) {
  if (!transferPhone || typeof transferPhone !== 'string' || transferPhone.trim() === '') {
    throw new Error('Invalid human agent transfer phone number configured')
  }

  const twiml = new VoiceResponse()
  twiml.say({ voice: 'alice' }, 'Please hold while I transfer you to a human agent.')

  const serverUrl = process.env.SERVER_URL || ''
  twiml.dial({
    action: `${serverUrl}/webhooks/twilio/dial-status`,
    method: 'POST',
    timeout: 15
  }, transferPhone)

  const twimlString = twiml.toString()

  if (callSid) {
    try {
      await twilioClient.calls(callSid).update({ twiml: twimlString })
    } catch (err) {
      console.error('Twilio handoff redirect error:', err)
      throw new Error(`Twilio redirect failed: ${err.message || 'Call unavailable'}`)
    }
  }

  await prisma.call.updateMany({
    where: { twilioSid: callSid },
    data: { status: "TRANSFERRED" }
  })

  getIO().to(tenantId).emit("human_handoff", { callSid, transferPhone })

  return twimlString
}
