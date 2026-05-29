const { XMLParser } = require('fast-xml-parser')

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false })

/**
 * Parse a Vietnamese e-invoice XML buffer into an Invoice object.
 * @param {Buffer|string} xmlContent
 * @param {string} filename
 * @returns {{ ok: true, invoice: Invoice } | { ok: false, error: string }}
 */
function parseInvoiceXML(xmlContent, filename) {
  try {
    const result = parser.parse(xmlContent)
    const dl = result?.HDon?.DLHDon

    if (!dl) return { ok: false, error: `${filename}: Missing DLHDon root element` }

    const invoiceCode = dl.TTChung?.KHHDon || dl.KHHDon
    const invoiceNumber = dl.TTChung?.SHDon ? String(dl.TTChung.SHDon) : (dl.SHDon ? String(dl.SHDon) : undefined)
    const seller = dl.NDHDon?.NBan
    const payment = dl.NDHDon?.TToan

    const missing = []
    if (invoiceCode == null || invoiceCode === '') missing.push('KHHDon')
    if (invoiceNumber == null || invoiceNumber === '') missing.push('SHDon')
    if (seller?.Ten == null || seller?.Ten === '') missing.push('NBan.Ten')
    if (seller?.MST == null || seller?.MST === '') missing.push('NBan.MST')
    if (seller?.DChi == null || seller?.DChi === '') missing.push('NBan.DChi')
    if (payment?.TgTTTBSo == null || payment?.TgTTTBSo === '') missing.push('TToan.TgTTTBSo')

    if (missing.length > 0) {
      return { ok: false, error: `${filename}: Missing fields: ${missing.join(', ')}` }
    }

    return {
      ok: true,
      invoice: {
        id: `${invoiceCode}-${invoiceNumber}`,
        source: 'xml',
        filename,
        invoiceCode,
        invoiceNumber,
        sellerName: seller.Ten,
        taxId: seller.MST,
        sellerAddress: seller.DChi,
        totalAmount: Number(payment.TgTTTBSo),
        status: 'pending'
      }
    }
  } catch (e) {
    return { ok: false, error: `${filename}: Parse error — ${e.message}` }
  }
}

module.exports = { parseInvoiceXML }
