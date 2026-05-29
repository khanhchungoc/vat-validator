const XLSX = require('xlsx')
const path = require('path')
const fs = require('fs')

const STATUS_LABELS = {
  pass: 'Pass',
  'invalid-invoice': 'Invalid Invoice',
  'invalid-business': 'Invalid Business',
  skipped: 'Skipped',
  pending: 'Pending'
}

const STATUS_FILLS = {
  pass: { fgColor: { argb: 'FF90EE90' } },           // light green
  'invalid-invoice': { fgColor: { argb: 'FFFF9999' } }, // light red
  'invalid-business': { fgColor: { argb: 'FFFF9999' } },
  skipped: { fgColor: { argb: 'FFFFE066' } },          // light yellow
  pending: { fgColor: { argb: 'FFFFFFFF' } }
}

/**
 * Generates an Excel summary of processed invoices.
 * @param {string} sessionDir - The directory where the summary.xlsx will be saved.
 * @param {Array} invoices - The list of invoice objects.
 * @returns {string} The absolute path to the generated Excel file.
 */
function generateXLSX(sessionDir, invoices) {
  const wb = XLSX.utils.book_new()
  const header = ['#', 'Invoice Code', 'Invoice Number', 'Seller Name', 'Tax ID', 'Amount (VND)', 'Status']
  const rows = invoices.map((inv, i) => [
    i + 1,
    inv.invoiceCode,
    inv.invoiceNumber,
    inv.sellerName,
    inv.taxId,
    inv.totalAmount,
    STATUS_LABELS[inv.status] || inv.status
  ])

  const wsData = [header, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [ { wch: 4 }, { wch: 14 }, { wch: 16 }, { wch: 45 }, { wch: 18 }, { wch: 16 }, { wch: 20 } ]

  // Note: Standard 'xlsx' (Community Edition) does NOT support cell styles (colors, fonts).
  // For styles, a package like 'xlsx-js-style' or 'exceljs' would be needed.
  // We're keeping the STATUS_FILLS structure here for future compatibility if we switch libraries.

  XLSX.utils.book_append_sheet(wb, ws, 'Summary')
  const outputPath = path.join(sessionDir, 'summary.xlsx')
  XLSX.writeFile(wb, outputPath)
  return outputPath
}

module.exports = { generateXLSX }
