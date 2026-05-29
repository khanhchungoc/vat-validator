const express = require('express')
const { createSession, loadSession, listIncompleteSessions, OUTPUT_DIR } = require('../sessionManager')
const { loadInvoices, clearInvoices } = require('../invoiceStore')
const { getIsRunning } = require('../automation/automationEngine')
const path = require('path')
const fs = require('fs')

const router = express.Router()

// GET /sessions - list all incomplete sessions
router.get('/', (req, res) => {
  res.json(listIncompleteSessions())
})

// POST /sessions/new - create a new session, returns { sessionDir }
router.post('/new', (req, res) => {
  clearInvoices()
  const session = createSession()
  if (!session) return res.status(500).json({ error: 'Failed to create session' })
  res.json({ sessionDir: session.sessionDir, id: session.id })
})

// POST /sessions/resume - load a session into the invoice store
router.post('/resume', (req, res) => {
  if (getIsRunning()) {
    return res.status(400).json({ error: 'Cannot resume session while automation is running' })
  }

  const { sessionDir } = req.body
  if (!sessionDir) return res.status(400).json({ error: 'sessionDir required' })

  // Validate sessionDir belongs to OUTPUT_DIR
  const absolute = path.resolve(sessionDir)
  if (!absolute.startsWith(path.resolve(OUTPUT_DIR))) {
    return res.status(400).json({ error: 'Invalid session directory' })
  }

  const session = loadSession(sessionDir)
  if (!session) {
    if (!fs.existsSync(sessionDir)) {
      return res.status(404).json({ error: 'Session directory does not exist' })
    }
    return res.status(404).json({ error: 'Session metadata (session.json) not found' })
  }

  // Load pending invoices into store (skip completed ones)
  // Re-map 'processing' to 'pending' to retry interrupted ones
  const toResume = session.invoices.map(i =>
    (i.status === 'processing') ? { ...i, status: 'pending' } : i
  )
  loadInvoices(toResume)

  res.json({ session, invoices: toResume })
})

module.exports = router
