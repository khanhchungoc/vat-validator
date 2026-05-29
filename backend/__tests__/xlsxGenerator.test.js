const fs = require('fs')
const path = require('path')
const { generateXLSX } = require('../output/xlsxGenerator')
const XLSX = require('xlsx')

describe('xlsxGenerator', () => {
  const testDir = path.join(__dirname, 'test-output')

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true })
    }
  })

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('should generate a summary.xlsx with correct data', () => {
    const invoices = [
      {
        invoiceCode: '1C22MAA',
        invoiceNumber: '12345',
        sellerName: 'Company A',
        taxId: '0101010101',
        totalAmount: 1100000,
        status: 'pass'
      },
      {
        invoiceCode: '1C22MBB',
        invoiceNumber: '67890',
        sellerName: 'Company B',
        taxId: '0202020202',
        totalAmount: 2200000,
        status: 'invalid-invoice'
      }
    ]

    const outputPath = generateXLSX(testDir, invoices)
    expect(fs.existsSync(outputPath)).toBe(true)
    expect(path.basename(outputPath)).toBe('summary.xlsx')

    // Read it back to verify content
    const workbook = XLSX.readFile(outputPath)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet)

    expect(data.length).toBe(2)
    expect(data[0]['Invoice Number']).toBe('12345')
    expect(data[0]['Status']).toBe('Pass')
    expect(data[1]['Invoice Number']).toBe('67890')
    expect(data[1]['Status']).toBe('Invalid Invoice')
  })
})
