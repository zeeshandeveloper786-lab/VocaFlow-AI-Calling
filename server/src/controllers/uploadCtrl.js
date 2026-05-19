
import db, { pool } from '../lib/db.js'
import { ingestDoc } from '../lib/rag.js'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

export const uploadCSV = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    // Limit to 2MB CSV files to prevent Out Of Memory crashes
    if (req.file.size > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'CSV file size must not exceed 2MB' })
    }

    const csv = req.file.buffer.toString('utf8')
    const lines = csv.split(/\r?\n/).filter(l => l.trim())

    if (lines.length < 2) return res.status(400).json({ error: 'CSV needs headers and at least one row' })
    
    // Limit to maximum 5000 leads per import to protect DB transaction performance
    if (lines.length > 5001) {
      return res.status(400).json({ error: 'CSV exceeds maximum limit of 5000 rows' })
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]+/g, ''))
    const leads = []

    const sanitizeCSVValue = (val) => {
      if (typeof val !== 'string') return val
      let clean = val.trim().replace(/^"|"$/g, '')
      // Block Formula Injection attacks (=, +, -, @ prefixes)
      if (clean.startsWith('=') || clean.startsWith('+') || clean.startsWith('-') || clean.startsWith('@')) {
        clean = clean.replace(/^[=\+\-@]+/, '')
      }
      return clean
    }

    const sanitizePakistaniPhone = (phone) => {
      if (typeof phone !== 'string') return ''
      let clean = phone.replace(/[^\d+]/g, '')
      if (clean.startsWith('03')) {
        clean = '92' + clean.slice(1)
      } else if (clean.startsWith('3') && clean.length === 10) {
        clean = '92' + clean
      } else if (clean.startsWith('92') && !clean.startsWith('+')) {
        clean = '+' + clean
      } else if (!clean.startsWith('+')) {
        clean = '+' + clean
      }
      return clean
    }

    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim())
      const lead = {}
      headers.forEach((h, idx) => {
        const v = vals[idx] || ''
        const sanitizedVal = sanitizeCSVValue(v)
        
        if (h === 'name') lead.name = sanitizedVal
        if (h === 'phone') lead.phone = sanitizePakistaniPhone(sanitizedVal)
        if (h === 'email') lead.email = sanitizedVal || null
        if (h === 'notes') lead.notes = sanitizedVal || null
      })
      if (lead.name && lead.phone) {
        lead.tenantId = req.user.tenantId
        leads.push(lead)
      }
    }

    const result = await db.lead.createMany({ data: leads, skipDuplicates: true })
    res.json({ count: result.count })
  } catch (err) {
    next(err)
  }
}

export const uploadPdf = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    // BUG 2 FIX: Prevent duplicate uploads
    const tenantId = req.user.tenantId
    const file = req.file
    const existing = await db.knowledgeDoc.findFirst({
      where: { tenantId, fileName: file.originalname }
    })
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A document with this name already exists. Delete it first before re-uploading.'
      })
    }

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(req.file.buffer) })
    const pdf = await loadingTask.promise
    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items.map(item => item.str).join(' ')
      fullText += pageText + '\n'
    }

    const doc = await db.knowledgeDoc.create({
      data: {
        tenantId: req.user.tenantId,
        fileName: req.file.originalname,
        content: fullText
      }
    })

    await ingestDoc(fullText, req.user.tenantId, doc.id)
    res.json({ docId: doc.id })
  } catch (err) {
    console.error('uploadPdf error:', err)
    next(err)
  }
}

export const listDocs = async (req, res, next) => {
  try {
    const docs = await db.knowledgeDoc.findMany({
      where: { tenantId: req.user.tenantId },
      select: {
        id: true,
        fileName: true,
        createdAt: true,
        _count: { select: { embeddings: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return res.json({ success: true, data: docs })
  } catch (err) {
    next(err)
  }
}

export const deleteDoc = async (req, res, next) => {
  try {
    const id = req.params.id
    const tenantId = req.user.tenantId
    const doc = await db.knowledgeDoc.findUnique({ where: { id } })
    if (!doc || doc.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // Wrap both deletions in a transaction to prevent inconsistent states
    await db.$transaction(async (tx) => {
      await tx.embedding.deleteMany({ where: { docId: id } })
      await tx.knowledgeDoc.delete({ where: { id, tenantId } })
    })

    res.json({ success: true })
  } catch (err) {
    console.error('deleteDoc error:', err)
    next(err)
  }
}
