const fs = require('fs')
const path = require('path')

const OUTPUT_DIR = path.join(process.cwd(), 'output')

function getTimestamp() {
  const d = new Date()
  return d.toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_')
}

function createSession() {
  const id = getTimestamp()
  const sessionDir = path.join(OUTPUT_DIR, id)
  fs.mkdirSync(path.join(sessionDir, 'screenshots'), { recursive: true })

  const session = {
    id,
    sessionDir,
    createdAt: new Date().toISOString(),
    status: 'incomplete',
    invoices: [],
    progress: { done: 0, total: 0 }
  }

  fs.writeFileSync(path.join(sessionDir, 'session.json'), JSON.stringify(session, null, 2))
  return session
}

function saveSession(sessionDir, invoices) {
  const done = invoices.filter(i => i.status !== 'pending' && i.status !== 'processing').length
  const session = {
    id: path.basename(sessionDir),
    sessionDir,
    status: (invoices.length > 0 && done === invoices.length) ? 'complete' : 'incomplete',
    invoices,
    progress: { done, total: invoices.length },
    updatedAt: new Date().toISOString()
  }
  fs.writeFileSync(path.join(sessionDir, 'session.json'), JSON.stringify(session, null, 2))
  return session
}

function loadSession(sessionDir) {
  const file = path.join(sessionDir, 'session.json')
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function listIncompleteSessions() {
  if (!fs.existsSync(OUTPUT_DIR)) return []

  return fs.readdirSync(OUTPUT_DIR)
    .map(name => {
      const sessionDir = path.join(OUTPUT_DIR, name)
      const file = path.join(sessionDir, 'session.json')
      if (!fs.existsSync(file)) return null
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'))
        return data.status === 'incomplete' ? data : null
      } catch { return null }
    })
    .filter(Boolean)
    .sort((a, b) => b.id.localeCompare(a.id))
}

module.exports = { createSession, saveSession, loadSession, listIncompleteSessions, OUTPUT_DIR }
