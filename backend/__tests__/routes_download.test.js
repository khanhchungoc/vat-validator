const express = require('express')
const fs = require('fs')
const path = require('path')
const downloadRouter = require('../routes/download')
const { OUTPUT_DIR } = require('../sessionManager')

jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs')
  return {
    ...originalFs,
    existsSync: jest.fn()
  }
})

// Helper to extract route handlers
function getHandler(method, pathStr) {
  const route = downloadRouter.stack.find(s => 
    s.route && 
    Object.keys(s.route.methods).includes(method.toLowerCase()) && 
    s.route.path === pathStr
  )
  return route ? route.route.stack[0].handle : null
}

describe('Download Routes Logic', () => {
  let req, res

  beforeEach(() => {
    jest.clearAllMocks()
    req = { params: {} }
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      download: jest.fn()
    }
  })

  describe('GET /pdf/:sessionId', () => {
    test('returns 404 if pdf file does not exist', () => {
      const handler = getHandler('GET', '/pdf/:sessionId')
      req.params.sessionId = 'test-session-123'
      fs.existsSync.mockReturnValue(false)

      handler(req, res)

      const expectedPath = path.join(OUTPUT_DIR, 'test-session-123', 'results.pdf')
      expect(fs.existsSync).toHaveBeenCalledWith(expectedPath)
      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ error: 'PDF not found' })
      expect(res.download).not.toHaveBeenCalled()
    })

    test('downloads file if pdf file exists', () => {
      const handler = getHandler('GET', '/pdf/:sessionId')
      req.params.sessionId = 'test-session-123'
      fs.existsSync.mockReturnValue(true)

      handler(req, res)

      const expectedPath = path.join(OUTPUT_DIR, 'test-session-123', 'results.pdf')
      expect(fs.existsSync).toHaveBeenCalledWith(expectedPath)
      expect(res.download).toHaveBeenCalledWith(
        expectedPath,
        'vatocr-results-test-session-123.pdf'
      )
      expect(res.status).not.toHaveBeenCalled()
    })

    test('returns 400 if session ID is invalid (e.g. contains path traversal or special chars)', () => {
      const handler = getHandler('GET', '/pdf/:sessionId')
      const invalidSessionIds = ['../session-123', 'session/123', 'session?123', 'session*123', 'session#123']

      invalidSessionIds.forEach(invalidId => {
        jest.clearAllMocks()
        req.params.sessionId = invalidId

        handler(req, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid session ID' })
        expect(fs.existsSync).not.toHaveBeenCalled()
        expect(res.download).not.toHaveBeenCalled()
      })
    })
  })

  describe('GET /xlsx/:sessionId', () => {
    test('returns 404 if xlsx file does not exist', () => {
      const handler = getHandler('GET', '/xlsx/:sessionId')
      req.params.sessionId = 'test-session-456'
      fs.existsSync.mockReturnValue(false)

      handler(req, res)

      const expectedPath = path.join(OUTPUT_DIR, 'test-session-456', 'summary.xlsx')
      expect(fs.existsSync).toHaveBeenCalledWith(expectedPath)
      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ error: 'XLSX not found' })
      expect(res.download).not.toHaveBeenCalled()
    })

    test('downloads file if xlsx file exists', () => {
      const handler = getHandler('GET', '/xlsx/:sessionId')
      req.params.sessionId = 'test-session-456'
      fs.existsSync.mockReturnValue(true)

      handler(req, res)

      const expectedPath = path.join(OUTPUT_DIR, 'test-session-456', 'summary.xlsx')
      expect(fs.existsSync).toHaveBeenCalledWith(expectedPath)
      expect(res.download).toHaveBeenCalledWith(
        expectedPath,
        'vatocr-summary-test-session-456.xlsx'
      )
      expect(res.status).not.toHaveBeenCalled()
    })

    test('returns 400 if session ID is invalid (e.g. contains path traversal or special chars)', () => {
      const handler = getHandler('GET', '/xlsx/:sessionId')
      const invalidSessionIds = ['../session-123', 'session/123', 'session?123', 'session*123', 'session#123']

      invalidSessionIds.forEach(invalidId => {
        jest.clearAllMocks()
        req.params.sessionId = invalidId

        handler(req, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid session ID' })
        expect(fs.existsSync).not.toHaveBeenCalled()
        expect(res.download).not.toHaveBeenCalled()
      })
    })
  })
})
