const { parseInvoiceXML } = require('../invoiceParser')
const fs = require('fs')
const path = require('path')

// FIXED PATH from the spec to point to the correct relative path in the workspace
const SAMPLE_XML = path.join(
  __dirname,
  '../../Requirements/Sample invoices/1159855_1_C26MGG/1159855_1_C26MGG/1159855_1_C26MGG.xml'
)

test('parses valid sample XML correctly', () => {
  const xml = fs.readFileSync(SAMPLE_XML)
  const result = parseInvoiceXML(xml, '1159855_1_C26MGG.xml')
  expect(result.ok).toBe(true)
  expect(result.invoice.invoiceCode).toBe('C26MGG')
  expect(result.invoice.invoiceNumber).toBe('1159855')
  expect(result.invoice.taxId).toBe('0102721191-068')
  expect(result.invoice.totalAmount).toBe(1355980)
})

test('returns error for empty XML', () => {
  const result = parseInvoiceXML('<HDon></HDon>', 'bad.xml')
  expect(result.ok).toBe(false)
  expect(result.error).toContain('Missing DLHDon')
})

test('returns error for XML missing required fields', () => {
  const xml = '<HDon><DLHDon><KHHDon>X</KHHDon></DLHDon></HDon>'
  const result = parseInvoiceXML(xml, 'partial.xml')
  expect(result.ok).toBe(false)
  expect(result.error).toContain('Missing fields')
})

test('handles edge case of positive decimal values and leading zeros', () => {
  const xml = `
  <HDon>
    <DLHDon>
      <TTChung>
        <KHHDon>C26MGG</KHHDon>
        <SHDon>0001234</SHDon>
      </TTChung>
      <NDHDon>
        <NBan>
          <Ten>Test</Ten>
          <MST>012345</MST>
          <DChi>Test Address</DChi>
        </NBan>
        <TToan>
          <TgTTTBSo>123.45</TgTTTBSo>
        </TToan>
      </NDHDon>
    </DLHDon>
  </HDon>
  `
  const result = parseInvoiceXML(xml, 'edge.xml')
  expect(result.ok).toBe(true)
  expect(result.invoice.invoiceNumber).toBe('0001234')
  expect(result.invoice.taxId).toBe('012345')
  expect(result.invoice.totalAmount).toBe(123.45)
})

test('returns error for invalid total amount (non-numeric, zero, or negative)', () => {
  const xmlZero = `
  <HDon>
    <DLHDon>
      <TTChung>
        <KHHDon>C26MGG</KHHDon>
        <SHDon>0001234</SHDon>
      </TTChung>
      <NDHDon>
        <NBan>
          <Ten>Test</Ten>
          <MST>012345</MST>
          <DChi>Test Address</DChi>
        </NBan>
        <TToan>
          <TgTTTBSo>0</TgTTTBSo>
        </TToan>
      </NDHDon>
    </DLHDon>
  </HDon>
  `
  const xmlNegative = xmlZero.replace('<TgTTTBSo>0</TgTTTBSo>', '<TgTTTBSo>-50</TgTTTBSo>')
  const xmlNonNumeric = xmlZero.replace('<TgTTTBSo>0</TgTTTBSo>', '<TgTTTBSo>abc</TgTTTBSo>')

  const resZero = parseInvoiceXML(xmlZero, 'zero.xml')
  expect(resZero.ok).toBe(false)
  expect(resZero.error).toContain('Invalid total amount')

  const resNegative = parseInvoiceXML(xmlNegative, 'negative.xml')
  expect(resNegative.ok).toBe(false)
  expect(resNegative.error).toContain('Invalid total amount')

  const resNonNumeric = parseInvoiceXML(xmlNonNumeric, 'nonnumeric.xml')
  expect(resNonNumeric.ok).toBe(false)
  expect(resNonNumeric.error).toContain('Invalid total amount')
})
