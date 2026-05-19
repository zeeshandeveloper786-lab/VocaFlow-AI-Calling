import multer from 'multer'

const storage = multer.memoryStorage()

const csvFilter = (req, file, cb) => {
  if (file.originalname.endsWith('.csv')) {
    cb(null, true)
  } else {
    cb(new Error('Only CSV files are allowed'))
  }
}

const pdfFilter = (req, file, cb) => {
  if (file.originalname.endsWith('.pdf')) {
    cb(null, true)
  } else {
    cb(new Error('Only PDF files are allowed'))
  }
}

const csvUpload = multer({
  storage,
  fileFilter: csvFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
})

const pdfUpload = multer({
  storage,
  fileFilter: pdfFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
})

export { csvUpload, pdfUpload }
