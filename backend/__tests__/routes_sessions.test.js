const express = require('express')
const path = require('path')
const sessionsRouter = require('../routes/sessions')
const { getIsRunning } = require('../automation/automationEngine')
const { clearInvoices, loadInvoices } = require('../invoiceStore')
const { createSession, loadSession, deleteSession, listIncompleteSessions } = require('../sessionManager')

jest.mock('../automation/automationEngine', () => ({
  getIsRunning: jest.fn()
}))

jest.mock('../invoiceStore', () => ({
  clearInvoices: jest.fn(),
  loadInvoices: jest.fn()
}))

jest.mock('../sessionManager', () => {
  const path = require('path')
  const mockOutputDir = path.resolve('output')
  return {
    createSession: jest.fn(),
    loadSession: jest.fn(),
    deleteSession: jest.fn(),
    listIncompleteSessions: jest.fn(),
    OUTPUT_DIR: mockOutputDir,
    validateDir: jest.fn().mockImplementation((dir) => {
      if (!dir) return false
      const absolute = path.resolve(dir)
      return absolute === mockOutputDir || absolute.startsWith(mockOutputDir + path.sep)
    })
  }
})

// Helper to extract route handlers
function getHandler(method, path) {
  const route = sessionsRouter.stack.find(s => 
    s.route && 
    Object.keys(s.route.methods).includes(method.toLowerCase()) && 
    s.route.path === path
  )
  return route ? route.route.stack[0].handle : null
}

describe('Sessions Routes Logic', () => {
  let req, res

  beforeEach(() => {
    jest.clearAllMocks()
    req = { body: {}, params: {}, query: {} }
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    }
  })

  describe('GET /', () => {
    test('returns incomplete sessions', () => {
      const handler = getHandler('GET', '/')
      const mockSessions = [{ id: '1' }]
      listIncompleteSessions.mockReturnValue(mockSessions)

      handler(req, res)

      expect(listIncompleteSessions).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(mockSessions)
    })
  })

  describe('POST /new', () => {
    test('creates a new session', () => {
      const handler = getHandler('POST', '/new')
      const mockSession = { id: 'new-id', sessionDir: 'dir' }
      createSession.mockReturnValue(mockSession)

      handler(req, res)

      expect(createSession).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({ sessionDir: 'dir', id: 'new-id' })
    })

    test('returns 500 if session creation fails', () => {
      const handler = getHandler('POST', '/new')
      createSession.mockReturnValue(null)

      handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe('POST /resume', () => {
    const handler = getHandler('POST', '/resume')
    const validDir = path.resolve('output', 'session1')

    test('returns 400 if automation is running', () => {
      getIsRunning.mockReturnValue(true)
      handler(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Cannot resume session while automation is running' })
    })

    test('returns 400 if sessionDir is missing', () => {
      getIsRunning.mockReturnValue(false)
      handler(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'sessionDir required' })
    })

    test('returns 400 if sessionDir is outside OUTPUT_DIR', () => {
      getIsRunning.mockReturnValue(false)
      req.body.sessionDir = path.resolve('Secret')
      handler(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid session directory' })
    })

    test('returns 404 if session metadata is missing', () => {
      getIsRunning.mockReturnValue(false)
      req.body.sessionDir = validDir
      loadSession.mockReturnValue(null)
      
      handler(req, res)
      expect(res.status).toHaveBeenCalledWith(404)
    })

    test('resumes session and loads invoices', () => {
      getIsRunning.mockReturnValue(false)
      req.body.sessionDir = validDir
      const mockInvoices = [
        { id: '1', status: 'pass' },
        { id: '2', status: 'processing' }
      ]
      loadSession.mockReturnValue({
        id: 'session1',
        invoices: mockInvoices
      })

      handler(req, res)

      expect(loadInvoices).toHaveBeenCalledWith([
        { id: '1', status: 'pass' },
        { id: '2', status: 'pending' } // processing -> pending
      ])
      expect(res.json).toHaveBeenCalled()
    })
  })

  describe('POST /delete', () => {
    const handler = getHandler('POST', '/delete')
    const validDir = path.resolve('output', 'session1')

    beforeEach(() => {
      getIsRunning.mockReturnValue(false)
    })

    test('returns 400 if automation is running', () => {
      getIsRunning.mockReturnValue(true)
      handler(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Cannot delete sessions while automation is running' })
    })

    test('returns 400 if sessionDir is missing', () => {
      handler(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'sessionDir required' })
    })

    test('returns 400 if sessionDir is invalid', () => {
      req.body.sessionDir = path.resolve('Secret')
      handler(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid session directory' })
    })

    test('returns 500 if deleteSession fails', () => {
      req.body.sessionDir = validDir
      deleteSession.mockReturnValue(false)
      handler(req, res)
      expect(res.status).toHaveBeenCalledWith(500)
    })

    test('returns 200/ok on success', () => {
      req.body.sessionDir = validDir
      deleteSession.mockReturnValue(true)
      handler(req, res)
      expect(res.json).toHaveBeenCalledWith({ ok: true })
    })
  })
})
