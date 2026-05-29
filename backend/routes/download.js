const express = require('express')
const path = require('path')
const fs = require('fs')
const { OUTPUT_DIR } = require('../sessionManager')

const router = express.Router()

// Helper to validate sessionId format to prevent path traversal
function isValidSessionId(sessionId) {
  return /^[a-zA-Z0-9_-]+$/.test(sessionId)
}

router.get('/pdf/:sessionId', (req, res) => {
  const { sessionId } = req.params
  if (!isValidSessionId(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' })
  }
  const filePath = path.join(OUTPUT_DIR, sessionId, 'results.pdf')
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'PDF not found' })
  res.download(filePath, `vatocr-results-${sessionId}.pdf`)
})

router.get('/xlsx/:sessionId', (req, res) => {
  const { sessionId } = req.params
  if (!isValidSessionId(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' })
  }
  const filePath = path.join(OUTPUT_DIR, sessionId, 'summary.xlsx')
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'XLSX not found' })
  res.download(filePath, `vatocr-summary-${sessionId}.xlsx`)
})

module.exports = router

