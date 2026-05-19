import express from 'express'
import { verifyToken, blockSuperAdmin } from '../middleware/auth.js'
import { csvUpload, pdfUpload } from '../lib/upload.js'
import { uploadCSV, uploadPdf, listDocs, deleteDoc } from '../controllers/uploadCtrl.js'
import { rateLimiter } from '../middleware/rateLimiter.js'

const router = express.Router()

router.use(verifyToken, blockSuperAdmin)

// Allow maximum 10 uploads per minute for safety
const uploadLimiter = rateLimiter({ windowMs: 60 * 1000, max: 10, message: 'Too many upload requests. Please try again later.' })

router.post('/leads-csv', uploadLimiter, csvUpload.single('file'), uploadCSV)
router.post('/pdf', uploadLimiter, pdfUpload.single('file'), uploadPdf)
router.get('/knowledge-docs', listDocs)
router.delete('/knowledge-docs/:id', deleteDoc)

export default router
