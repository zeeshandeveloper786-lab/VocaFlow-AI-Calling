
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function embed(text) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables')
  }
  const res = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  })
  return res.data[0].embedding
}
