const SITE2_URL = 'https://tracuunnt.gdt.gov.vn/tcnnt/mstdn.jsp'

/**
 * Run GDT Taxpayer Portal lookup for a single invoice.
 * @param {import('playwright').Page} page
 * @param {object} invoice - { taxId }
 * @param {function} onCaptcha - async (base64Image) => string answer
 * @param {function} [onLog] - function to log real-time progress steps
 * @returns {{ ok: boolean, screenshotBase64?: string, status: 'pass'|'invalid-business'|'skipped' }}
 */
async function runGdtTaxpayerPortal(page, invoice, onCaptcha, onLog = () => {}) {
  const currentUrl = page.url()
  if (!currentUrl.includes('tracuunnt.gdt.gov.vn')) {
    onLog('Navigating to Taxpayer Portal (https://tracuunnt.gdt.gov.vn/)...')
    await page.goto(SITE2_URL, { waitUntil: 'networkidle', timeout: 30000 })
  } else {
    onLog('Already on Taxpayer Portal. Resetting form fields for new query...')
    
    // Save current captcha src before refresh so we can wait for the change
    const oldSrc = await page.evaluate(() => {
      const img = document.querySelector('img[src*="captcha"]')
      return img ? img.getAttribute('src') : null
    })

    // Clear fields
    await page.fill('input[name="mst"], input[id*="mst"], input[placeholder*="mã số thuế"]', '')
    await page.fill('input#captcha, input[name="captcha"]', '')

    // On taxpayer portal, clicking the CAPTCHA image itself refreshes it
    const captchaImg = await page.$('img[src*="captcha"]')
    if (captchaImg) {
      await captchaImg.click()
      // Wait for captcha src to update
      await page.waitForFunction(
        (prevSrc) => {
          const img = document.querySelector('img[src*="captcha"]')
          return img && img.getAttribute('src') !== prevSrc
        },
        oldSrc,
        { timeout: 10000 }
      ).catch(() => {})
    }
  }

  // Fill Tax ID field directly using the exact, full tax ID (branch suffix included)
  await page.fill('input[name="mst"], input[id*="mst"], input[placeholder*="mã số thuế"]', invoice.taxId)

  let attempt = 0
  while (true) {
    attempt++
    onLog(`Capturing CAPTCHA image (attempt ${attempt})...`)
    const captchaEl = await page.$('img[src*="captcha"]')
    if (!captchaEl) throw new Error('CAPTCHA element not found on GDT Taxpayer Portal')

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
    const answer = await onCaptcha(captchaBase64, attempt)
    if (answer === null) {
      return { ok: false, status: 'skipped' }
    }

    onLog(`Submitting CAPTCHA answer: "${answer}"...`)

    // Save current CAPTCHA src before submitting so we can detect when it updates on retry
    const oldCaptchaSrc = await page.evaluate(() => {
      const img = document.querySelector('img[src*="captcha"]')
      return img ? img.getAttribute('src') : null
    })

    // Fill and submit CAPTCHA with event-driven typing
    const inputSelector = 'input#captcha, input[name="captcha"]'
    await page.focus(inputSelector)
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Backspace')
    await page.type(inputSelector, answer.trim().toUpperCase(), { delay: 100 })

    await page.click('input.subBtn, .subBtn, button[type="submit"], input[type="submit"], a:has-text("Tìm kiếm")')

    // Wait for any of GDT's three distinct result states to appear in the DOM
    await page.locator('text=Vui lòng nhập đúng mã xác nhận')
      .or(page.locator('text=BẢNG THÔNG TIN TRA CỨU'))
      .or(page.locator('text=Không tìm thấy người nộp thuế'))
      .waitFor({ state: 'visible', timeout: 15000 })
      .catch(() => {})

    // Check which element won the race
    const hasWrongCaptcha = await page.$('text=Vui lòng nhập đúng mã xác nhận')
    if (hasWrongCaptcha && await hasWrongCaptcha.isVisible()) {
      onLog('GDT returned "Vui lòng nhập đúng mã xác nhận!" (Incorrect CAPTCHA). Refreshing and retrying...')

      // Wait for captcha src to actually change to prevent screenshotting the old CAPTCHA
      await page.waitForFunction(
        (prevSrc) => {
          const img = document.querySelector('img[src*="captcha"]')
          return img && img.getAttribute('src') !== prevSrc
        },
        oldCaptchaSrc,
        { timeout: 10000 }
      ).catch(() => {})

      continue
    }

    const hasSuccessTable = await page.$('text=BẢNG THÔNG TIN TRA CỨU')
    if (hasSuccessTable && await hasSuccessTable.isVisible()) {
      onLog('Verification successful! Capturing business status screenshot...')
      const screenshotBuffer = await page.screenshot({ fullPage: false })
      const screenshotBase64 = screenshotBuffer.toString('base64')
      return { ok: true, screenshotBase64, status: 'pass' }
    }

    const hasNoResult = await page.$('text=Không tìm thấy người nộp thuế')
    if (hasNoResult && await hasNoResult.isVisible()) {
      onLog('Taxpayer not found (Invalid business!). Capturing error screenshot...')
      const screenshotBuffer = await page.screenshot({ fullPage: false })
      const screenshotBase64 = screenshotBuffer.toString('base64')
      return { ok: true, screenshotBase64, status: 'invalid-business' }
    }

    // Fallback: If other status or timeout occurs, check if form is still visible
    const formIsStillVisible = await page.$('input#captcha')
    if (formIsStillVisible && await formIsStillVisible.isVisible()) {
      onLog('CAPTCHA incorrect or timeout occurred. Retrying...')
      continue
    }

    break
  }

  // Final Fallback Screenshot
  const screenshotBuffer = await page.screenshot({ fullPage: false })
  const screenshotBase64 = screenshotBuffer.toString('base64')

  const isNotFound = await page.locator('text=Không tìm thấy')
    .or(page.locator('text=không có kết quả'))
    .or(page.locator('.no-result'))
    .first()
    .isVisible()
    .catch(() => false)
  const status = isNotFound ? 'invalid-business' : 'pass'

  return { ok: true, screenshotBase64, status }
}

/**
 * Strip branch suffix from Tax ID (e.g. "0102721191-068" -> "0102721191").
 * Kept for test suite backward compatibility.
 */
function stripBranchSuffix(taxId) {
  return taxId.split('-')[0]
}

module.exports = { runGdtTaxpayerPortal, stripBranchSuffix }
