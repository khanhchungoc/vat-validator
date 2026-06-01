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
 * @param {function} onCaptcha - async (base64Image) => string answer
 * @returns {{ ok: boolean, screenshotBase64?: string, status: 'pass'|'invalid-business'|'skipped' }}
 */
async function runSite2(page, invoice, onCaptcha, onLog = () => {}) {
  const rootTaxId = stripBranchSuffix(invoice.taxId)
  onLog(`Stripping branch suffix from Tax ID (using: ${rootTaxId})...`)
  onLog('Navigating to Taxpayer Portal (https://tracuunnt.gdt.gov.vn/)...')
  await page.goto(SITE2_URL, { waitUntil: 'networkidle', timeout: 30000 })

  // Fill Tax ID field
  await page.fill('input[name="mst"], input[id*="mst"], input[placeholder*="mã số thuế"]', rootTaxId)

  let attempt = 0
  while (true) {
    attempt++
    onLog(`Capturing CAPTCHA image (attempt ${attempt})...`)
    // Capture CAPTCHA image
    const captchaEl = await page.$('img[src*="captcha"]')
    if (!captchaEl) throw new Error('CAPTCHA element not found on Site 2')

    await captchaEl.scrollIntoViewIfNeeded()

    // Wait for image bytes to arrive
    await page.waitForFunction(
      el => el.complete && el.naturalWidth > 0 && el.naturalHeight > 0,
      captchaEl,
      { timeout: 10000 }
    ).catch(() => {})

    await page.waitForTimeout(500)

    const captchaBuffer = await captchaEl.screenshot()
    const captchaBase64 = captchaBuffer.toString('base64')

    onLog('Prompting user for CAPTCHA input...')
    // Ask frontend for answer
    const answer = await onCaptcha(captchaBase64, attempt)
    if (answer === null) {
      return { ok: false, status: 'skipped' }
    }

    onLog(`Submitting CAPTCHA answer: "${answer}"...`)
    // Fill and submit CAPTCHA
    await page.fill('input#captcha, input[name="captcha"]', answer)
    await page.click('input.subBtn, .subBtn, button[type="submit"], input[type="submit"], a:has-text("Tìm kiếm")')
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})

    // Check for CAPTCHA failure (if the form is still visible, the CAPTCHA was wrong)
    await page.waitForTimeout(1000)
    const formIsStillVisible = await page.$('input#captcha')
    if (formIsStillVisible && await formIsStillVisible.isVisible()) {
      onLog('CAPTCHA incorrect. Refreshing and retrying...')
      continue
    }

    break
  }

  // Screenshot result
  const screenshotBuffer = await page.screenshot({ fullPage: false })
  const screenshotBase64 = screenshotBuffer.toString('base64')

  // Check for not-found result
  const isNotFound = await page.$('text=Không tìm thấy, text=không có kết quả, .no-result')
  if (isNotFound) {
    onLog('Taxpayer not found (Invalid business!). Capturing error screenshot...')
  } else {
    onLog('Verification successful! Capturing business status screenshot...')
  }
  const status = isNotFound ? 'invalid-business' : 'pass'

  return { ok: true, screenshotBase64, status }
}

module.exports = { runSite2, stripBranchSuffix }
