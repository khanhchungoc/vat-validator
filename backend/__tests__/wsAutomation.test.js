const { handleMessage } = require('../wsHandler')
const engine = require('../automation/automationEngine')

jest.mock('../automation/automationEngine', () => ({
  startProcessing: jest.fn().mockResolvedValue(),
  stopProcessing: jest.fn().mockResolvedValue(),
  submitCaptchaAnswer: jest.fn(),
  skipInvoice: jest.fn(),
  advanceStep: jest.fn(),
  pauseProcessing: jest.fn(),
  resumeProcessing: jest.fn()
}))

describe('WS Automation Integration', () => {
  let ws

  beforeEach(() => {
    ws = { send: jest.fn() }
    jest.clearAllMocks()
  })

  test('start-processing calls engine.startProcessing', async () => {
    const payload = { sessionDir: 'test-dir', mode: 'step' }
    await handleMessage(ws, { type: 'start-processing', payload })
    expect(engine.startProcessing).toHaveBeenCalledWith('test-dir', 'step')
  })

  test('start-processing forwards browser window bounds when present', async () => {
    const browserBounds = { x: 960, y: 0, width: 960, height: 1040 }
    const payload = { sessionDir: 'test-dir', mode: 'auto', browserBounds }

    await handleMessage(ws, { type: 'start-processing', payload })

    expect(engine.startProcessing).toHaveBeenCalledWith('test-dir', 'auto', browserBounds)
  })

  test('start-processing rejects invalid sessionDir', async () => {
    const payload = { sessionDir: '../danger', mode: 'auto' }
    await handleMessage(ws, { type: 'start-processing', payload })
    expect(engine.startProcessing).not.toHaveBeenCalled()
    expect(ws.send).toHaveBeenCalled()
    const response = JSON.parse(ws.send.mock.calls[0][0])
    expect(response.type).toBe('error')
    expect(response.payload).toBe('Invalid session directory')
  })

  test('stop-processing calls engine.stopProcessing', async () => {
    await handleMessage(ws, { type: 'stop-processing' })
    expect(engine.stopProcessing).toHaveBeenCalled()
  })

  test('captcha-answer calls engine.submitCaptchaAnswer', async () => {
    const payload = { answer: '12345' }
    await handleMessage(ws, { type: 'captcha-answer', payload })
    expect(engine.submitCaptchaAnswer).toHaveBeenCalledWith('12345')
  })

  test('skip-invoice calls engine.skipInvoice', async () => {
    await handleMessage(ws, { type: 'skip-invoice' })
    expect(engine.skipInvoice).toHaveBeenCalled()
  })

  test('advance-step calls engine.advanceStep', async () => {
    await handleMessage(ws, { type: 'advance-step' })
    expect(engine.advanceStep).toHaveBeenCalled()
  })

  test('set-mode paused calls engine.pauseProcessing', async () => {
    await handleMessage(ws, { type: 'set-mode', payload: { mode: 'paused' } })
    expect(engine.pauseProcessing).toHaveBeenCalled()
  })

  test('set-mode anything else calls engine.resumeProcessing', async () => {
    await handleMessage(ws, { type: 'set-mode', payload: { mode: 'auto' } })
    expect(engine.resumeProcessing).toHaveBeenCalled()
  })
})
