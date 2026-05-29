const fs = require('fs')
const path = require('path')

const OUTPUT_DIR = path.join(process.cwd(), 'output')

function validateDir(dir) {
  if (!dir || typeof dir !== 'string') return false
  const absolute = path.resolve(dir)
  return absolute.startsWith(path.resolve(OUTPUT_DIR))
}

function getTimestamp() {
  const d = new Date()
  return d.toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_')
}

function createSession() {
  try {
    const id = getTimestamp()
    const sessionDir = path.join(OUTPUT_DIR, id)

    if (!validateDir(sessionDir)) {
      throw new Error(`Invalid session directory: ${sessionDir}`)
    }

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
  } catch (err) {
    console.error('Failed to create session:', err)
    return null
  }
}

function saveSession(sessionDir, invoices = []) {
  try {
    if (!validateDir(sessionDir)) {
      throw new Error(`Invalid session directory: ${sessionDir}`)
    }

    const safeInvoices = Array.isArray(invoices) ? invoices : []
    const done = safeInvoices.filter(i => i.status !== 'pending' && i.status !== 'processing').length
    const session = {
      id: path.basename(sessionDir),
      sessionDir,
      status: (safeInvoices.length > 0 && done === safeInvoices.length) ? 'complete' : 'incomplete',
      invoices: safeInvoices,
      progress: { done, total: safeInvoices.length },
      updatedAt: new Date().toISOString()
    }
    fs.writeFileSync(path.join(sessionDir, 'session.json'), JSON.stringify(session, null, 2))
    return session
  } catch (err) {
    console.error('Failed to save session:', err)
    return null
  }
}

function loadSession(sessionDir) {
  try {
    if (!validateDir(sessionDir)) {
      throw new Error(`Invalid session directory: ${sessionDir}`)
    }
    const file = path.join(sessionDir, 'session.json')
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    console.error('Failed to load session:', err)
    return null
  }
}

function listIncompleteSessions() {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) return []

    return fs.readdirSync(OUTPUT_DIR)
      .map(name => {
        const sessionDir = path.join(OUTPUT_DIR, name)
        if (!validateDir(sessionDir)) return null

        const file = path.join(sessionDir, 'session.json')
        if (!fs.existsSync(file)) return null
        try {
          const data = JSON.parse(fs.readFileSync(file, 'utf8'))
          return data.status === 'incomplete' ? data : null
        } catch (err) {
          console.error(`Failed to parse session file ${file}:`, err)
          return null
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.id.localeCompare(a.id))
  } catch (err) {
    console.error('Failed to list sessions:', err)
    return []
  }
}

module.exports = { createSession, saveSession, loadSession, listIncompleteSessions, OUTPUT_DIR }
