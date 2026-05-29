const { handleMessage } = require('../wsHandler')
const engine = require('../automation/automationEngine')

jest.mock('../automation/automationEngine', () => ({
  startProcessing: jest.fn(),
  submitCaptchaAnswer: jest.fn(),
  skipInvoice: jest.fn(),
  advanceStep: jest.fn(),
  pauseProcessing: jest.fn(),
  resumeProcessing: jest.fn(),
  setBroadcast: jest.fn()
}))

describe('WS Automation Messages', () => {
  const ws = { send: jest.fn() }

  test('start-processing', () => {
    const payload = { sessionDir: 'test-dir', mode: 'auto' }
    handleMessage(ws, { type: 'start-processing', payload })
    expect(engine.startProcessing).toHaveBeenCalledWith('test-dir', 'auto')
  })

  test('captcha-answer', () => {
    const payload = { answer: '1234' }
    handleMessage(ws, { type: 'captcha-answer', payload })
    expect(engine.submitCaptchaAnswer).toHaveBeenCalledWith('1234')
  })

  test('skip-invoice', () => {
    handleMessage(ws, { type: 'skip-invoice' })
    expect(engine.skipInvoice).toHaveBeenCalled()
  })

  test('advance-step', () => {
    handleMessage(ws, { type: 'advance-step' })
    expect(engine.advanceStep).toHaveBeenCalled()
  })

  test('set-mode paused', () => {
    handleMessage(ws, { type: 'set-mode', payload: { mode: 'paused' } })
    expect(engine.pauseProcessing).toHaveBeenCalled()
  })

  test('set-mode resumed', () => {
    handleMessage(ws, { type: 'set-mode', payload: { mode: 'manual' } })
    expect(engine.resumeProcessing).toHaveBeenCalled()
  })
})
