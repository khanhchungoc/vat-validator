const express = require('express')
const { createSession, loadSession, deleteSession, listIncompleteSessions, OUTPUT_DIR, validateDir } = require('../sessionManager')
const { loadInvoices } = require('../invoiceStore')
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
  // NOTE: do NOT clear invoices here — they are added to the store BEFORE
  // the session is created, so clearing would wipe them before processing starts.
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
  if (!validateDir(sessionDir)) {
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

// POST /sessions/delete - delete a session folder
router.post('/delete', (req, res) => {
  if (getIsRunning()) {
    return res.status(400).json({ error: 'Cannot delete sessions while automation is running' })
  }

  const { sessionDir } = req.body
  if (!sessionDir) return res.status(400).json({ error: 'sessionDir required' })

  if (!validateDir(sessionDir)) {
    return res.status(400).json({ error: 'Invalid session directory' })
  }

  const success = deleteSession(sessionDir)
  if (!success) {
    return res.status(500).json({ error: 'Failed to delete session' })
  }

  res.json({ ok: true })
})

module.exports = router
