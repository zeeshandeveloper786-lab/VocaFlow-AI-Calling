
import db, { pool } from './db.js'
import { embed } from './embeddings.js'

export async function ingestDoc(text, tenantId, docId) {
  // BUG 4 FIX: OpenAI key guard
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for document embedding')
  }

  // BUG 3 FIX: Sentence-aware chunking
  const sentences = text.split(/(?<=[.!?])\s+/)
  const chunks = []
  let current = ''
  for (const sentence of sentences) {
    if ((current + ' ' + sentence).length > 500 && current.length > 0) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current = current ? current + ' ' + sentence : sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())
  const validChunks = chunks.filter(c => c.length > 20)

  for (const chunk of validChunks) {
    const embedding = await embed(chunk)
    const vectorStr = '[' + embedding.join(',') + ']'
    const id = crypto.randomUUID()
    await pool.query(
      `INSERT INTO "Embedding" (id, "docId", "tenantId", "chunkText", vector) VALUES ($1, $2, $3, $4, $5::vector)`,
      [id, docId, tenantId, chunk, vectorStr]
    )
  }
}

export async function queryRAG(query, tenantId, knowledgeDocId = null) {
  // BUG 4 FIX: OpenAI key guard
  if (!process.env.OPENAI_API_KEY) {
    console.error('RAG skipped: OPENAI_API_KEY not set')
    return ''
  }

  const queryVector = await embed(query)
  const vectorStr = '[' + queryVector.join(',') + ']'

  let queryText = `SELECT "chunkText", 1 - (vector <=> $1::vector) AS similarity FROM "Embedding" WHERE "tenantId" = $2`
  const params = [vectorStr, tenantId]

  if (knowledgeDocId) {
    queryText += ` ORDER BY CASE WHEN "docId" = $3 THEN 0 ELSE 1 END, similarity DESC LIMIT 5`
    params.push(knowledgeDocId)
  } else {
    queryText += ` ORDER BY similarity DESC LIMIT 5`
  }

  const results = await pool.query(queryText, params)
  return results.rows.map(r => r.chunkText).join('\n\n')
}

export async function retrieve(tenantId, query, knowledgeDocId = null) {
  return await queryRAG(query, tenantId, knowledgeDocId)
}
