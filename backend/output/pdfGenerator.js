const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

function formatAmount(amount) {
  return Number(amount).toLocaleString('vi-VN') + ' ₫'
}

function buildInvoicePageHTML(invoice, screenshotsDir) {
  const site1Path = invoice.site1Screenshot
    ? path.join(screenshotsDir, invoice.site1Screenshot)
    : null
  const site2Path = invoice.site2Screenshot
    ? path.join(screenshotsDir, invoice.site2Screenshot)
    : null

  const toBase64 = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return null
    try {
      return fs.readFileSync(filePath).toString('base64')
    } catch (e) {
      console.error(`Failed to read screenshot: ${filePath}`, e)
      return null
    }
  }

  const site1B64 = toBase64(site1Path)
  const site2B64 = toBase64(site2Path)

  const imgTag = (b64, label) => b64
    ? `<div class="screenshot-col">
        <div class="screenshot-label">${label}</div>
        <img src="data:image/png;base64,${b64}" class="screenshot" />
       </div>`
    : `<div class="screenshot-col"><div class="screenshot-label">${label}</div><p class="no-screenshot">Not captured</p></div>`

  return `
    <div class="invoice-page">
      <div class="invoice-header">
        <h2>Invoice: ${invoice.invoiceCode} / ${invoice.invoiceNumber}</h2>
        <span class="status-badge status-${invoice.status}">${invoice.status.replace('-', ' ').toUpperCase()}</span>
      </div>
      <table class="invoice-meta">
        <tr><td>Seller</td><td>${invoice.sellerName}</td></tr>
        <tr><td>Tax ID</td><td>${invoice.taxId}</td></tr>
        <tr><td>Address</td><td>${invoice.sellerAddress || '—'}</td></tr>
        <tr><td>Total Amount</td><td>${formatAmount(invoice.totalAmount)}</td></tr>        
      </table>
      <div class="screenshots">
        ${imgTag(site1B64, 'Website 1 — hoadondientu.gdt.gov.vn')}
        ${imgTag(site2B64, 'Website 2 — tracuunnt.gdt.gov.vn')}
      </div>
    </div>
  `
}

const PAGE_CSS = `
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #222; }
  .invoice-page { page-break-after: always; }
  .invoice-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #4472C4; margin-bottom: 8px; padding-bottom: 6px; }
  .invoice-header h2 { margin: 0; font-size: 14px; color: #4472C4; }
  .status-badge { padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: bold; }
  .status-pass { background: #90EE90; color: #155724; }
  .status-invalid-invoice, .status-invalid-business { background: #FF9999; color: #721c24; }
  .status-skipped { background: #FFE066; color: #856404; }
  .invoice-meta { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  .invoice-meta td { padding: 3px 6px; border: 1px solid #ddd; }
  .invoice-meta td:first-child { font-weight: bold; width: 100px; background: #f5f5f5; }   
  .screenshots { display: flex; gap: 10px; }
  .screenshot-col { flex: 1; }
  .screenshot-label { font-weight: bold; font-size: 10px; color: #555; margin-bottom: 4px; }
  .screenshot { width: 100%; border: 1px solid #ccc; border-radius: 4px; }
  .no-screenshot { color: #999; font-style: italic; }
`

/**
 * Generate results.pdf for a batch.
 * @param {string} sessionDir
 * @param {Invoice[]} invoices - must have site1Screenshot and site2Screenshot filenames   
 * @returns {Promise<string>} path to generated PDF
 */
async function generatePDF(sessionDir, invoices) {
  const screenshotsDir = path.join(sessionDir, 'screenshots')

  const pagesHTML = invoices
    .map(inv => buildInvoicePageHTML(inv, screenshotsDir))
    .join('\n')

  const fullHTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${PAGE_CSS}</style></head>
<body>${pagesHTML}</body></html>`

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setContent(fullHTML, { waitUntil: 'networkidle' })

  const outputPath = path.join(sessionDir, 'results.pdf')
  await page.pdf({ path: outputPath, format: 'A4', landscape: true, printBackground: true })
  await browser.close()

  return outputPath
}

module.exports = { generatePDF }
