const fs = require('fs')
const path = require('path')
const { createSession, saveSession, loadSession, deleteSession, listIncompleteSessions, OUTPUT_DIR } = require('../sessionManager')

describe('sessionManager', () => {
  beforeEach(() => {
    if (fs.existsSync(OUTPUT_DIR)) {
      fs.rmSync(OUTPUT_DIR, { recursive: true, force: true })
    }
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  })

  test('createSession should create session folder and session.json', () => {
    const session = createSession()
    
    expect(session.id).toBeDefined()
    expect(session.sessionDir).toBe(path.join(OUTPUT_DIR, session.id))
    expect(fs.existsSync(session.sessionDir)).toBe(true)
    expect(fs.existsSync(path.join(session.sessionDir, 'screenshots'))).toBe(true)
    expect(fs.existsSync(path.join(session.sessionDir, 'session.json'))).toBe(true)

    const data = JSON.parse(fs.readFileSync(path.join(session.sessionDir, 'session.json'), 'utf8'))
    expect(data.id).toBe(session.id)
    expect(data.status).toBe('incomplete')
    expect(data.invoices).toEqual([])
  })

  test('saveSession should update session.json and status', () => {
    const session = createSession()
    const invoices = [
      { id: '1', status: 'done' },
      { id: '2', status: 'pending' }
    ]

    const updated = saveSession(session.sessionDir, invoices)
    
    expect(updated.status).toBe('incomplete')
    expect(updated.progress.done).toBe(1)
    expect(updated.progress.total).toBe(2)
    expect(updated.invoices).toEqual(invoices)

    const saved = JSON.parse(fs.readFileSync(path.join(session.sessionDir, 'session.json'), 'utf8'))
    expect(saved.status).toBe('incomplete')
    expect(saved.progress.done).toBe(1)

    // Complete session
    const allDone = [
      { id: '1', status: 'done' },
      { id: '2', status: 'done' }
    ]
    const completed = saveSession(session.sessionDir, allDone)
    expect(completed.status).toBe('complete')
    expect(completed.progress.done).toBe(2)
  })

  test('loadSession should load session data', () => {
    const session = createSession()
    const loaded = loadSession(session.sessionDir)
    expect(loaded.id).toBe(session.id)
    expect(loaded.status).toBe('incomplete')

    expect(loadSession('non-existent')).toBe(null)
  })

  test('deleteSession should delete the session folder', () => {
    const session = createSession()
    expect(fs.existsSync(session.sessionDir)).toBe(true)
    
    const deleted = deleteSession(session.sessionDir)
    expect(deleted).toBe(true)
    expect(fs.existsSync(session.sessionDir)).toBe(false)
  })

  test('deleteSession should not delete the root output folder', () => {
    const deleted = deleteSession(OUTPUT_DIR)
    expect(deleted).toBe(false)
    expect(fs.existsSync(OUTPUT_DIR)).toBe(true)
  })

  test('listIncompleteSessions should list incomplete sessions sorted newest first', () => {
    const s1 = createSession()
    // Wait a bit to ensure different timestamps if needed, but getTimestamp has second precision
    // Actually, createSession uses getTimestamp which might be same if called too fast.
    // Let's manually create some folders if needed or just trust the mock/delay.
    
    // To ensure different IDs, I'll manually create session folders with specific names
    const oldSessionDir = path.join(OUTPUT_DIR, '2023_01_01_00-00-00')
    fs.mkdirSync(oldSessionDir, { recursive: true })
    const oldSession = { id: '2023_01_01_00-00-00', status: 'incomplete' }
    fs.writeFileSync(path.join(oldSessionDir, 'session.json'), JSON.stringify(oldSession))

    const completedDir = path.join(OUTPUT_DIR, '2023_01_02_00-00-00')
    fs.mkdirSync(completedDir, { recursive: true })
    const completedSession = { id: '2023_01_02_00-00-00', status: 'complete' }
    fs.writeFileSync(path.join(completedDir, 'session.json'), JSON.stringify(completedSession))

    const list = listIncompleteSessions()
    expect(list.length).toBe(2) // s1 and oldSession
    expect(list[0].id > list[1].id).toBe(true)
    expect(list.find(s => s.status === 'complete')).toBeUndefined()
  })
})
