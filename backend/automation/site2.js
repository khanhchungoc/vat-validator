const SITE2_URL = 'https://tracuunnt.gdt.gov.vn/tcnnt/mstdn.jsp'

/**
 * Strip branch suffix from Tax ID (e.g. "0102721191-068" -> "0102721191").
 */
function stripBranchSuffix(taxId) {
  return taxId.split('-')[0]
}

/**
 * Run Website 2 lookup for a single invoice.
 * @param {import('playwright').Page} page
 * @param {object} invoice - { taxId }
 * @returns {{ ok: boolean, screenshotBase64?: string, status: 'pass'|'invalid-business' }}
 */
async function runSite2(page, invoice) {
  const rootTaxId = stripBranchSuffix(invoice.taxId)

  await page.goto(SITE2_URL, { waitUntil: 'networkidle', timeout: 30000 })

  // Fill Tax ID field and submit
  await page.fill('input[name="mst"], input[id*="mst"], input[placeholder*="mã số thuế"]', rootTaxId)
  await page.click('button[type="submit"], input[type="submit"], a:has-text("Tìm kiếm")')
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  // Screenshot result
  const screenshotBuffer = await page.screenshot({ fullPage: false })
  const screenshotBase64 = screenshotBuffer.toString('base64')

  // Check for not-found result
  const isNotFound = await page.$('text=Không tìm thấy, text=không có kết quả, .no-result')
  const status = isNotFound ? 'invalid-business' : 'pass'

  return { ok: true, screenshotBase64, status }
}

module.exports = { runSite2, stripBranchSuffix }
