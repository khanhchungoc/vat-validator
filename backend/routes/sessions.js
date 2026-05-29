const express = require('express')
const { createSession, loadSession, listIncompleteSessions } = require('../sessionManager')
const { loadInvoices } = require('../invoiceStore')

const router = express.Router()

// GET /sessions - list all incomplete sessions
router.get('/', (req, res) => {
  res.json(listIncompleteSessions())
})

// POST /sessions/new - create a new session, returns { sessionDir }
router.post('/new', (req, res) => {
  const session = createSession()
  if (!session) return res.status(500).json({ error: 'Failed to create session' })
  res.json({ sessionDir: session.sessionDir, id: session.id })
})

// POST /sessions/resume - load a session into the invoice store
router.post('/resume', (req, res) => {
  const { sessionDir } = req.body
  if (!sessionDir) return res.status(400).json({ error: 'sessionDir required' })

  const session = loadSession(sessionDir)
  if (!session) return res.status(404).json({ error: 'Session not found' })

  // Load pending invoices into store (skip completed ones)
  // Re-map 'processing' to 'pending' to retry interrupted ones
  const toResume = session.invoices.map(i =>
    (i.status === 'processing') ? { ...i, status: 'pending' } : i
  )
  loadInvoices(toResume)

  res.json({ session, invoices: toResume })
})

module.exports = router
