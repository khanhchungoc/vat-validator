const express = require('express')
const multer = require('multer')
const { parseInvoiceXML } = require('../invoiceParser')
const { addInvoice } = require('../invoiceStore')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// POST /upload — accepts multiple XML files
router.post('/', upload.array('files'), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' })
  }

  const results = []
  const duplicates = []

  for (const file of req.files) {
    const parsed = parseInvoiceXML(file.buffer, file.originalname)
    if (!parsed.ok) {
      results.push({ filename: file.originalname, ok: false, error: parsed.error })
      continue
    }
    const added = addInvoice(parsed.invoice)
    if (!added.ok) {
      duplicates.push(parsed.invoice.id)
      results.push({ filename: file.originalname, ok: false, error: added.error })
    } else {
      results.push({ filename: file.originalname, ok: true, invoice: parsed.invoice })
    }
  }

  res.json({ results, duplicates })
})

module.exports = router
