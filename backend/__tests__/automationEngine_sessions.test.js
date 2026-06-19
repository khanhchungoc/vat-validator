const engine = require('../automation/automationEngine')
const { saveSession } = require('../sessionManager')
const { getInvoices, updateInvoiceStatus } = require('../invoiceStore')
const { runGdtInvoicePortal } = require('../automation/gdtInvoicePortal')
const { runGdtTaxpayerPortal } = require('../automation/gdtTaxpayerPortal')
const { chromium } = require('playwright')

jest.mock('../sessionManager')
jest.mock('../invoiceStore')
jest.mock('../automation/gdtInvoicePortal')
jest.mock('../automation/gdtTaxpayerPortal')
jest.mock('playwright')
jest.mock('../output/pdfGenerator', () => ({
  generatePDF: jest.fn().mockResolvedValue('mock-pdf-path')
}))
jest.mock('../output/xlsxGenerator', () => ({
  generateXLSX: jest.fn().mockReturnValue('mock-xlsx-path')
}))
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs')
  return {
    ...actualFs,
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn()
  }
})

describe('Automation Engine Session Saving', () => {
  let mockPage
  let mockBrowser

  beforeEach(async () => {
    await engine.stopProcessing()
    jest.clearAllMocks()
    delete process.env.VATOCR_BROWSER_BOUNDS
    mockPage = {
      goto: jest.fn(),
      close: jest.fn(),
      setViewportSize: jest.fn().mockResolvedValue(undefined)
    }
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn()
    }
    chromium.launch.mockResolvedValue(mockBrowser)

    getInvoices.mockReturnValue([
      { id: 'inv1', taxId: 'TAX001', status: 'pending' }
    ])

    runGdtInvoicePortal.mockResolvedValue({ status: 'pass', screenshotBase64: 'abc' })
    runGdtTaxpayerPortal.mockResolvedValue({ status: 'pass', screenshotBase64: 'def' })
  })

  test('should broadcast captcha-required with site: 1 for Phase 1', async () => {
    const broadcastMock = jest.fn()
    engine.setBroadcast(broadcastMock)

    runGdtInvoicePortal.mockImplementationOnce(async (page, invoice, onCaptcha, onLog) => {
      onCaptcha('mock-image-data-1', 1)
      return { status: 'pass', screenshotBase64: 'abc' }
    })

    await engine.startProcessing('test-session-dir', 'auto')

    expect(broadcastMock).toHaveBeenCalledWith({
      type: 'captcha-required',
      payload: {
        id: 'inv1',
        image: 'mock-image-data-1',
        attempt: 1,
        site: 1
      }
    })
  })

  test('should broadcast captcha-required with site: 2 for Phase 2', async () => {
    const broadcastMock = jest.fn()
    engine.setBroadcast(broadcastMock)

    runGdtTaxpayerPortal.mockImplementationOnce(async (page, invoice, onCaptcha, onLog) => {
      onCaptcha('mock-image-data-2', 1)
      return { status: 'pass', screenshotBase64: 'def' }
    })

    await engine.startProcessing('test-session-dir', 'auto')

    expect(broadcastMock).toHaveBeenCalledWith({
      type: 'captcha-required',
      payload: {
        id: 'inv1',
        image: 'mock-image-data-2',
        attempt: 1,
        site: 2
      }
    })
  })

  test('should call saveSession when starting processing and after completion', async () => {
    await engine.startProcessing('test-session-dir', 'auto')

    // Initial processing status
    expect(updateInvoiceStatus).toHaveBeenCalledWith('inv1', 'processing')

    // Phase 1 intermediate status
    expect(updateInvoiceStatus).toHaveBeenCalledWith('inv1', 'site1-done', expect.any(Object))

    // Final pass status (from Phase 2)
    expect(updateInvoiceStatus).toHaveBeenCalledWith('inv1', 'pass', expect.any(Object))

    // saveSession is called for each phase transition plus the finally block.
    // For one invoice passing both phases: processing → site1-done → final → finally = 4 times
    expect(saveSession).toHaveBeenCalledTimes(4)
    expect(saveSession).toHaveBeenCalledWith('test-session-dir', expect.any(Array))
  })

  test('should run Site 2 only once per unique Tax ID across multiple invoices', async () => {
    // Two invoices with the SAME tax ID
    getInvoices.mockReturnValue([
      { id: 'inv1', taxId: 'TAX001', status: 'pending' },
      { id: 'inv2', taxId: 'TAX001', status: 'pending' }
    ])

    await engine.startProcessing('test-session-dir', 'auto')

    // Site 1 called twice (once per invoice)
    expect(runGdtInvoicePortal).toHaveBeenCalledTimes(2)

    // Site 2 called only ONCE despite two invoices sharing the same Tax ID
    expect(runGdtTaxpayerPortal).toHaveBeenCalledTimes(1)
  })

  test('should position the GDT browser from Electron-provided split-screen bounds', async () => {
    process.env.VATOCR_BROWSER_BOUNDS = JSON.stringify({
      x: 960,
      y: 0,
      width: 960,
      height: 1040
    })

    await engine.startProcessing('test-session-dir', 'auto')

    expect(chromium.launch).toHaveBeenCalledWith({
      headless: false,
      args: ['--window-position=960,0', '--window-size=960,1040']
    })
    expect(mockPage.setViewportSize).toHaveBeenCalledWith({ width: 960, height: 920 })
  })

  test('should prefer explicit app-provided browser bounds over environment bounds', async () => {
    process.env.VATOCR_BROWSER_BOUNDS = JSON.stringify({
      x: 100,
      y: 100,
      width: 800,
      height: 600
    })
    const browserBounds = { x: 960, y: 0, width: 960, height: 1040 }

    await engine.startProcessing('test-session-dir', 'auto', browserBounds)

    expect(chromium.launch).toHaveBeenCalledWith({
      headless: false,
      args: ['--window-position=960,0', '--window-size=960,1040']
    })
    expect(mockPage.setViewportSize).toHaveBeenCalledWith({ width: 960, height: 920 })
  })
})
