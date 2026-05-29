const express = require('express')
const sessionsRouter = require('../routes/sessions')
const { getIsRunning } = require('../automation/automationEngine')
const { clearInvoices, loadInvoices } = require('../invoiceStore')
const { createSession, loadSession, listIncompleteSessions } = require('../sessionManager')

jest.mock('../automation/automationEngine', () => ({
  getIsRunning: jest.fn()
}))

jest.mock('../invoiceStore', () => ({
  clearInvoices: jest.fn(),
  loadInvoices: jest.fn()
}))

jest.mock('../sessionManager', () => ({
  createSession: jest.fn(),
  loadSession: jest.fn(),
  listIncompleteSessions: jest.fn(),
  OUTPUT_DIR: 'C:\\Users\\KhanhChuNgoc\\Documents\\Personal Projects\\VATOCR\\output',
  validateDir: jest.fn().mockImplementation((dir) => {
    if (!dir) return false
    const path = require('path')
    const absolute = path.resolve(dir)
    const base = path.resolve('C:\\Users\\KhanhChuNgoc\\Documents\\Personal Projects\\VATOCR\\output')
    return absolute === base || absolute.startsWith(base + path.sep)
  })
}))

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
    test('clears invoices and creates a new session', () => {
      const handler = getHandler('POST', '/new')
      const mockSession = { id: 'new-id', sessionDir: 'dir' }
      createSession.mockReturnValue(mockSession)

      handler(req, res)

      expect(clearInvoices).toHaveBeenCalled()
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
    const validDir = 'C:\\Users\\KhanhChuNgoc\\Documents\\Personal Projects\\VATOCR\\output\\session1'

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
      req.body.sessionDir = 'C:\\Users\\KhanhChuNgoc\\Documents\\Secret'
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
})
