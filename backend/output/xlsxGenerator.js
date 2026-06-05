const XLSX = require('xlsx-js-style')
const path = require('path')
const fs = require('fs')

const STATUS_LABELS = {
  pass: 'Hợp lệ',
  'invalid-invoice': 'Hóa đơn không hợp lệ',
  'invalid-business': 'Doanh nghiệp không hoạt động',
  skipped: 'Đã bỏ qua',
  pending: 'Đang chờ',
  processing: 'Đang xử lý'
}

const STATUS_FILLS = {
  pass: { patternType: 'solid', fgColor: { argb: 'FF90EE90' } },           // light green
  'invalid-invoice': { patternType: 'solid', fgColor: { argb: 'FFFF9999' } }, // light red
  'invalid-business': { patternType: 'solid', fgColor: { argb: 'FFFF9999' } },
  skipped: { patternType: 'solid', fgColor: { argb: 'FFFFE066' } },          // light yellow
  pending: { patternType: 'solid', fgColor: { argb: 'FFFFFFFF' } },
  processing: { patternType: 'solid', fgColor: { argb: 'FFD9ECFF' } }         // light blue
}

/**
 * Generates an Excel summary of processed invoices.
 * @param {string} sessionDir - The directory where the summary.xlsx will be saved.
 * @param {Array} invoices - The list of invoice objects.
 * @returns {string} The absolute path to the generated Excel file.
 */
function generateXLSX(sessionDir, invoices) {
  const wb = XLSX.utils.book_new()
  const header = ['STT', 'Ký hiệu hóa đơn', 'Số hóa đơn', 'Tên người bán', 'Mã số thuế', 'Tổng tiền (VND)', 'Trạng thái']
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
  
  // Apply column widths
  ws['!cols'] = [ { wch: 5 }, { wch: 18 }, { wch: 18 }, { wch: 50 }, { wch: 18 }, { wch: 18 }, { wch: 30 } ]

  // Apply header styling
  const range = XLSX.utils.decode_range(ws['!ref'])
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: C })
    if (!ws[cellRef]) continue
    ws[cellRef].s = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { patternType: 'solid', fgColor: { argb: 'FF4472C4' } },
      alignment: { horizontal: 'center' }
    }
  }

  // Apply row styling based on status
  invoices.forEach((inv, i) => {
    const rowIdx = i + 1
    const fill = STATUS_FILLS[inv.status] || STATUS_FILLS.pending
    
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: C })
      if (!ws[cellRef]) continue
      ws[cellRef].s = { fill }
    }
  })

  XLSX.utils.book_append_sheet(wb, ws, 'Summary')
  const outputPath = path.join(sessionDir, 'summary.xlsx')
  XLSX.writeFile(wb, outputPath)
  return outputPath
}

module.exports = { generateXLSX }
