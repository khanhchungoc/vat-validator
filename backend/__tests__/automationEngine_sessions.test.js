const engine = require('../automation/automationEngine')
const { saveSession } = require('../sessionManager')
const { getInvoices, updateInvoiceStatus } = require('../invoiceStore')
const { runSite1 } = require('../automation/site1')
const { runSite2 } = require('../automation/site2')
const { chromium } = require('playwright')

jest.mock('../sessionManager')
jest.mock('../invoiceStore')
jest.mock('../automation/site1')
jest.mock('../automation/site2')
jest.mock('playwright')
jest.mock('../output/pdfGenerator', () => ({
  generatePDF: jest.fn().mockResolvedValue('mock-pdf-path')
}))
jest.mock('../output/xlsxGenerator', () => ({
  generateXLSX: jest.fn().mockReturnValue('mock-xlsx-path')
}))

describe('Automation Engine Session Saving', () => {
  let mockPage
  let mockBrowser

  beforeEach(() => {
    jest.clearAllMocks()
    mockPage = {
      goto: jest.fn(),
      close: jest.fn()
    }
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn()
    }
    chromium.launch.mockResolvedValue(mockBrowser)
    
    getInvoices.mockReturnValue([
      { id: 'inv1', status: 'pending' }
    ])

    runSite1.mockResolvedValue({ status: 'pass', screenshotBase64: 'abc' })
    runSite2.mockResolvedValue({ status: 'pass', screenshotBase64: 'def' })
  })

  test('should call saveSession when starting processing and after completion', async () => {
    await engine.startProcessing('test-session-dir', 'auto')

    // Initial processing status
    expect(updateInvoiceStatus).toHaveBeenCalledWith('inv1', 'processing')
    
    // Final pass status
    expect(updateInvoiceStatus).toHaveBeenCalledWith('inv1', 'pass', expect.any(Object))

    // saveSession should be called 3 times for one invoice:
    // 1. After status set to 'processing'
    // 2. After status set to 'pass'
    // 3. In the finally block
    expect(saveSession).toHaveBeenCalledTimes(3)
    expect(saveSession).toHaveBeenCalledWith('test-session-dir', expect.any(Array))
  })
})
