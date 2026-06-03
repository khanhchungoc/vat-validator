const { verifySiteLoaded } = require('../automation/gdtInvoicePortal')

describe('verifySiteLoaded', () => {
  let mockPage
  let logs

  beforeEach(() => {
    logs = []
    mockPage = {
      goto: jest.fn().mockResolvedValue(null),
      waitForSelector: jest.fn().mockResolvedValue(null),
    }
  })

  const logFn = (msg) => logs.push(msg)

  test('resolves true on immediate success', async () => {
    const result = await verifySiteLoaded(mockPage, 'https://test.url', '#target', 3, logFn)
    expect(result).toBe(true)
    expect(mockPage.waitForSelector).toHaveBeenCalledTimes(1)
    expect(mockPage.goto).not.toHaveBeenCalled()
    expect(logs).toContain('Verifying GDT Portal loaded successfully...')
    expect(logs).toContain('GDT Portal loaded successfully!')
  })

  test('retries on failure and resolves true on subsequent success', async () => {
    // Fail once, then succeed
    mockPage.waitForSelector
      .mockRejectedValueOnce(new Error('Timeout waiting for selector'))
      .mockResolvedValueOnce(null)

    const result = await verifySiteLoaded(mockPage, 'https://test.url', '#target', 3, logFn)
    expect(result).toBe(true)
    expect(mockPage.waitForSelector).toHaveBeenCalledTimes(2)
    expect(mockPage.goto).toHaveBeenCalledTimes(1)
    expect(mockPage.goto).toHaveBeenCalledWith('https://test.url', { waitUntil: 'networkidle', timeout: 30000 })
    expect(logs.some(l => l.includes('Site load check failed on attempt 1'))).toBe(true)
    expect(logs.some(l => l.includes('Reloading GDT Portal page (attempt 2/3)'))).toBe(true)
    expect(logs).toContain('GDT Portal loaded successfully!')
  })

  test('resolves false after max attempts fail', async () => {
    mockPage.waitForSelector.mockRejectedValue(new Error('Timeout waiting for selector'))

    const result = await verifySiteLoaded(mockPage, 'https://test.url', '#target', 3, logFn)
    expect(result).toBe(false)
    expect(mockPage.waitForSelector).toHaveBeenCalledTimes(3)
    expect(mockPage.goto).toHaveBeenCalledTimes(2) // attempt 2 and 3 reloads
    expect(logs.some(l => l.includes('Site load check failed on attempt 3'))).toBe(true)
  })
})
