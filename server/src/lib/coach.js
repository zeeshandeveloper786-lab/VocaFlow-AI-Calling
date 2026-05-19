
import '../env.js'
import { chat } from './llm.js'
import db from './db.js'

async function analyzeCall(callId, tenantId) {
  try {
    const call = await db.call.findUnique({
      where: { id: callId },
      include: { agent: true }
    })

    if (!call) {
      console.log('Call not found for coaching:', callId)
      return null
    }

    if (!call.transcript || call.transcript.trim().length < 10) {
      console.log('Transcript too short for coaching analysis:', callId)
      const report = await db.coachingReport.create({
        data: {
          callId,
          tenantId,
          agentId: call.agentId,
          mistakes: [],
          insights: 'The call session was too brief or no conversation was recorded to generate coaching recommendations.'
        }
      })
      return report
    }

    const systemPrompt = `You are an expert sales coach. Analyze this call transcript. Return ONLY valid JSON with this shape:
{
  "mistakes": [{"moment": "string", "issue": "string", "betterResponse": "string"}],
  "insights": "string"
}
Identify max 3 mistakes. insights is a 2-sentence overall coaching summary. Do NOT include any markdown code blocks or explanatory text around the JSON.`
    const userMessage = `Transcript: ${call.transcript}`
    const response = await chat(systemPrompt, userMessage, true)
    
    let cleanResponse = response.trim()
    if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim()
    }

    const data = JSON.parse(cleanResponse)
    const mistakes = Array.isArray(data.mistakes) ? data.mistakes.slice(0, 3) : []
    const insights = data.insights || 'No insights available'

    const report = await db.coachingReport.create({
      data: {
        callId,
        tenantId,
        agentId: call.agentId,
        mistakes,
        insights
      }
    })

    return report
  } catch (err) {
    console.error('Coaching analysis error:', err)
    return null
  }
}

export { analyzeCall }
