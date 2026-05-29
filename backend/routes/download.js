const express = require('express')
const path = require('path')
const fs = require('fs')
const { OUTPUT_DIR } = require('../sessionManager')

const router = express.Router()

router.get('/pdf/:sessionId', (req, res) => {
  const filePath = path.join(OUTPUT_DIR, req.params.sessionId, 'results.pdf')
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'PDF not found' })
  res.download(filePath, `vatocr-results-${req.params.sessionId}.pdf`)
})

router.get('/xlsx/:sessionId', (req, res) => {
  const filePath = path.join(OUTPUT_DIR, req.params.sessionId, 'summary.xlsx')
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'XLSX not found' })
  res.download(filePath, `vatocr-summary-${req.params.sessionId}.xlsx`)
})

module.exports = router
