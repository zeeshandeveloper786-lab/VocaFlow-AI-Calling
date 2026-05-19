import { chat } from "./llm.js"
import prisma from "./db.js"
import { getIO } from "./socket.js"

export async function scoreCall(transcript, leadId, tenantId, callId) {
  if (!transcript) {
    return { score: 0, conversionChance: 0, urgency: "low", keyInsights: [], scoreReason: "No transcript" }
  }

  const prompt = `You are a sales call quality analyst. Analyze this call transcript.
Return a valid JSON object with the following properties:
{
  "score": number (0-100),
  "conversionChance": number (0-100),
  "urgency": "low" | "medium" | "high",
  "keyInsights": string[],
  "scoreReason": string,
  "sentiment": "POSITIVE" | "NEGATIVE" | "NEUTRAL",
  "sentimentScore": number (0-100),
  "isQualified": boolean,
  "isBooked": boolean,
  "bookingDate": string | null,
  "objectionDetected": boolean,
  "objectionType": "TOO_EXPENSIVE" | "CALL_LATER" | "NOT_INTERESTED" | "NEED_TEAM" | "GENERIC" | null,
  "objectionResponse": string | null
}`

  const raw = await chat(prompt, transcript, true)
  let result
  try {
    result = JSON.parse(raw)
  } catch {
    result = {
      score: 50,
      conversionChance: 50,
      urgency: "medium",
      keyInsights: [],
      scoreReason: "Parse error",
      sentiment: "NEUTRAL",
      sentimentScore: 50,
      isQualified: false,
      isBooked: false,
      bookingDate: null,
      objectionDetected: false,
      objectionType: null,
      objectionResponse: null
    }
  }

  // 1. Update Lead score and status
  if (leadId) {
    const leadUpdate = {
      score: result.score !== undefined ? result.score : 50,
      scoreReason: result.scoreReason || "Completed call"
    }

    if (result.isBooked) {
      leadUpdate.status = "BOOKED"
    } else if (result.isQualified) {
      leadUpdate.status = "QUALIFIED"
    } else {
      // Default fallback if currently pending
      const currentLead = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true } })
      if (currentLead?.status === "PENDING") {
        leadUpdate.status = "CONTACTED"
      }
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: leadUpdate
    }).catch((err) => console.error("Lead update error in scorer:", err))
  }

  // 2. Create Appointment if booked
  if (result.isBooked && leadId) {
    try {
      const callRecord = callId ? await prisma.call.findUnique({ where: { id: callId } }) : null
      const agentId = callRecord?.agentId
      if (agentId) {
        let scheduledAt = new Date()
        scheduledAt.setDate(scheduledAt.getDate() + 1) // Default to tomorrow
        if (result.bookingDate) {
          const parsedDate = new Date(result.bookingDate)
          if (!isNaN(parsedDate.getTime())) {
            scheduledAt = parsedDate
          }
        }

        await prisma.appointment.create({
          data: {
            tenantId,
            leadId,
            agentId,
            scheduledAt,
            status: "PENDING"
          }
        })
      }
    } catch (err) {
      console.error("Failed to create post-call appointment:", err)
    }
  }

  // 3. Compile call analysis and update Call record
  if (callId) {
    const analysisObj = {
      score: result.score,
      conversionChance: result.conversionChance,
      urgency: result.urgency,
      keyInsights: result.keyInsights,
      scoreReason: result.scoreReason
    }

    if (result.objectionDetected) {
      analysisObj.objection = {
        detected: true,
        type: result.objectionType || "GENERIC",
        response: result.objectionResponse || "I understand your concern."
      }
    }

    const callUpdate = {
      analysis: JSON.stringify(analysisObj),
      sentiment: result.sentiment || "NEUTRAL",
      sentimentScore: result.sentimentScore !== undefined ? result.sentimentScore : 50
    }

    // If an objection was raised, override sentiment to NEGATIVE for the Objection Rate query
    if (result.objectionDetected) {
      callUpdate.sentiment = "NEGATIVE"
    }

    await prisma.call.update({
      where: { id: callId },
      data: callUpdate
    }).catch((err) => console.error("Call update error in scorer:", err))
  }

  getIO().to(tenantId).emit("lead_scored", result)
  return result
}
