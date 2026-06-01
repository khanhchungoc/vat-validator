const { stripBranchSuffix } = require('../automation/gdtTaxpayerPortal')

test('strips branch suffix', () => {
  expect(stripBranchSuffix('0102721191-068')).toBe('0102721191')
})

test('leaves plain tax id unchanged', () => {
  expect(stripBranchSuffix('0102721191')).toBe('0102721191')
})
