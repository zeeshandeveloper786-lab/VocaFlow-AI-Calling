
import { chat } from './llm.js'

export async function handleObjection(transcript, tenantId) {
  try {
    const systemPrompt = 'You are an expert sales AI. Detect if the following transcript contains a sales objection. If yes, identify the type from: TOO_EXPENSIVE, CALL_LATER, NOT_INTERESTED, NEED_TEAM, GENERIC. Then generate a confident, empathetic response to overcome it. Return JSON only: { detected: boolean, type: string|null, response: string|null }'
    const response = await chat(systemPrompt, transcript, true)
    const result = JSON.parse(response)
    return result
  } catch (err) {
    console.error('Objection handling error:', err)
    return { detected: false, type: null, response: null }
  }
}
