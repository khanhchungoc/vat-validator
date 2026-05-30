const SITE1_URL = 'https://hoadondientu.gdt.gov.vn/'

/**
 * Run Website 1 lookup for a single invoice.
 * @param {import('playwright').Page} page
 * @param {object} invoice - { invoiceCode, invoiceNumber, totalAmount }
 * @param {function} onCaptcha - async (base64Image) => string answer
 * @returns {{ ok: boolean, screenshotBase64?: string, status: 'pass'|'invalid-invoice'|'skipped' }}
 */
async function runSite1(page, invoice, onCaptcha) {
  await page.goto(SITE1_URL, { waitUntil: 'networkidle', timeout: 30000 })

  // Fill form fields
  await page.fill('input[name="khhdon"], input[placeholder*="ký hiệu"], input[id*="khhdon"]', invoice.invoiceCode)
  await page.fill('input[name="shdon"], input[placeholder*="số hóa đơn"], input[id*="shdon"]', String(invoice.invoiceNumber))
  await page.fill('input[name="tgtttbso"], input[placeholder*="tổng tiền"], input[id*="tgtttbso"]', String(invoice.totalAmount))

  let attempt = 0
  while (true) {
    attempt++
    // Capture CAPTCHA image
    const captchaEl = await page.$('img[src*="captcha"], img[alt*="captcha"], img[id*="captcha"]')
    if (!captchaEl) throw new Error('CAPTCHA element not found on Site 1')

    // Scroll into view so the browser renders it
    await captchaEl.scrollIntoViewIfNeeded()

    // Wait for the image bytes to arrive
    await page.waitForFunction(
      el => el.complete && el.naturalWidth > 0 && el.naturalHeight > 0,
      captchaEl,
      { timeout: 10000 }
    ).catch(() => {})

    // Give the browser extra time to fully paint the image onto the canvas
    await new Promise(r => setTimeout(r, 800))

    // Use page-level clipped screenshot — captures actual painted pixels,
    // not the element's pre-paint buffer which is what element.screenshot() uses
    const box = await captchaEl.boundingBox()
    const captchaBuffer = box
      ? await page.screenshot({ clip: box })
      : await captchaEl.screenshot()
    const captchaBase64 = captchaBuffer.toString('base64')

    // Ask frontend for answer (may return null if user skipped)
    const answer = await onCaptcha(captchaBase64, attempt)
    if (answer === null) {
      return { ok: false, status: 'skipped' }
    }

    // Fill and submit CAPTCHA
    await page.fill('input[name="captcha"], input[id*="captcha"]', answer)
    await page.click('button[type="submit"], input[type="submit"], button:has-text("Tìm kiếm")')
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    // Check for CAPTCHA failure (still on same page with error)
    const isCaptchaError = await page.$('text=Mã xác nhận không đúng, text=Sai mã captcha, .captcha-error')
    if (isCaptchaError) {
      // Loop: get new CAPTCHA
      continue
    }

    break
  }

  // Take result screenshot
  await page.waitForLoadState('networkidle', { timeout: 15000 })
  const screenshotBuffer = await page.screenshot({ fullPage: false })
  const screenshotBase64 = screenshotBuffer.toString('base64')

  // Determine pass/fail from page content
  const isInvalid = await page.$('text=Không tìm thấy, text=không hợp lệ, .result-error')
  const status = isInvalid ? 'invalid-invoice' : 'pass'

  return { ok: true, screenshotBase64, status }
}

module.exports = { runSite1 }
