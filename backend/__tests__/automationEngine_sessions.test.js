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

  beforeEach(() => {
    jest.clearAllMocks()
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
})
