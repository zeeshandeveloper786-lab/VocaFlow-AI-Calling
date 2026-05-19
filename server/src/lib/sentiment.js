
import { chat } from './llm.js'

async function analyzeSentiment(text) {
  const systemPrompt = 'You are a sentiment analyzer. Return only a number between 0 and 1. 0 = very negative, 0.5 = neutral, 1 = very positive.'
  const response = await chat(systemPrompt, text)
  const score = parseFloat(response.trim())
  const safeScore = isNaN(score) ? 0.5 : score
  const sentiment = safeScore > 0.6 ? 'POSITIVE' : safeScore < 0.4 ? 'NEGATIVE' : 'NEUTRAL'
  return { sentiment, score: Math.round(safeScore * 100) }
}

export { analyzeSentiment }
