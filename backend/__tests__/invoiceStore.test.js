const store = require('../invoiceStore')

beforeEach(() => store.clearInvoices())

const sample = {
  id: 'C26MGG-1159855', source: 'xml', invoiceCode: 'C26MGG',
  invoiceNumber: '1159855', sellerName: 'Test Co', taxId: '0102721191',
  sellerAddress: 'Hanoi', totalAmount: 1355980, status: 'pending'
}

test('adds invoice', () => {
  const result = store.addInvoice(sample)
  expect(result.ok).toBe(true)
  expect(store.getInvoices()).toHaveLength(1)
})

test('rejects duplicate invoice id', () => {
  store.addInvoice(sample)
  const result = store.addInvoice(sample)
  expect(result.ok).toBe(false)
  expect(result.error).toContain('Duplicate')
})

test('updates invoice status', () => {
  store.addInvoice(sample)
  store.updateInvoiceStatus('C26MGG-1159855', 'pass')
  expect(store.getInvoices()[0].status).toBe('pass')
})
