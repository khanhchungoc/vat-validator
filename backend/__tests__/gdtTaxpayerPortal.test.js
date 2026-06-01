const { stripBranchSuffix, getRandomDelay } = require('../automation/gdtTaxpayerPortal')

test('strips branch suffix', () => {
  expect(stripBranchSuffix('0102721191-068')).toBe('0102721191')
})

test('leaves plain tax id unchanged', () => {
  expect(stripBranchSuffix('0102721191')).toBe('0102721191')
})

test('getRandomDelay timing output contains ±7% dynamic jitter', () => {
  const base = 1000
  const jitter = Math.round(base * 0.07) // 70
  const min = base - jitter // 930
  const max = base + jitter // 1070

  for (let i = 0; i < 200; i++) {
    const delay = getRandomDelay(base)
    expect(delay).toBeGreaterThanOrEqual(min)
    expect(delay).toBeLessThanOrEqual(max)
  }
})

test('getRandomDelay has narrow 7% jitter for small timing values like 50ms', () => {
  const base = 50
  const jitter = Math.round(base * 0.07) // 4
  const min = base - jitter // 46
  const max = base + jitter // 54

  for (let i = 0; i < 200; i++) {
    const delay = getRandomDelay(base)
    expect(delay).toBeGreaterThanOrEqual(min)
    expect(delay).toBeLessThanOrEqual(max)
  }
})
