const SITE2_URL = 'https://tracuunnt.gdt.gov.vn/tcnnt/mstdn.jsp'

/**
 * Run GDT Taxpayer Portal lookup for a single invoice.
 * @param {import('playwright').Page} page
 * @param {object} invoice - { taxId }
 * @param {function} onCaptcha - async (base64Image, attempt) => string|null
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
    // Clear fields
    await page.fill('input[name="mst"], input[id*="mst"], input[placeholder*="mã số thuế"]', '')
    await page.fill('input#captcha, input[name="captcha"]', '')

    // On taxpayer portal, clicking the CAPTCHA image itself refreshes it
    const captchaImg = await page.$('img[src*="captcha"]')
    if (captchaImg) {
      await captchaImg.click()
      await page.waitForTimeout(1000)
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

    onLog('Please solve the CAPTCHA directly in GDT\'s opened browser window...')

    // Focus GDT's input field so they can immediately type without clicking it!
    try {
      await page.focus('input#captcha')
    } catch (e) {}

    let userSkipped = false
    let electronAnswer = null
    let raceFinished = false

    let resolveAnswerSubmitted
    const answerSubmittedPromise = new Promise(resolve => {
      resolveAnswerSubmitted = resolve
    })

    onCaptcha(captchaBase64, attempt).then(ans => {
      if (ans === null) {
        userSkipped = true
      } else {
        electronAnswer = ans
      }
      resolveAnswerSubmitted()
    }).catch(err => {
      console.error('[GDT Taxpayer Portal] CAPTCHA solving failed:', err.message)
      userSkipped = true
      resolveAnswerSubmitted()
    })

    // Site 2 submits standard HTML forms which trigger full-page reloads (navigation).
    // We wait for the navigation event so that we don't match the old, pre-existing error messages from the previous attempts.
    const navigationPromise = page.waitForNavigation({ waitUntil: 'networkidle', timeout: 600000 }).catch(() => null)

    // Wait for either the user to solve it in the GDT browser or Electron UI
    await Promise.race([
      navigationPromise,
      (async () => {
        await answerSubmittedPromise
        if (raceFinished) return
        if (userSkipped) return
        if (electronAnswer) {
          onLog(`Typing CAPTCHA answer "${electronAnswer}" into GDT portal...`)
          // Clear and focus GDT's taxpayer input field
          await page.fill('input#captcha', '')
          await page.focus('input#captcha')
          // Simulate human typing
          await page.keyboard.type(electronAnswer, { delay: 80 })
          // Click GDT's submit button natively inside GDT's form context.
          // This avoids matching global page header links (like the "Tra cứu" tab menu item) and triggers the exact onclick validators.
          const submitted = await page.evaluate(() => {
            const form = document.querySelector('form[name="fTcnnt"]') || document.forms[0]
            if (form) {
              const btn = form.querySelector('.subBtn') || form.querySelector('input[type="submit"]') || form.querySelector('button')
              if (btn) {
                btn.click()
                return true
              } else {
                form.submit()
                return true
              }
            }
            return false
          }).catch(() => false)

          if (!submitted) {
            // Fallback: Use standard Playwright click
            const fallbackBtn = page.locator('input.subBtn, .subBtn, input[type="submit"]').first()
            if (await fallbackBtn.isVisible().catch(() => false)) {
              await fallbackBtn.click()
            } else {
              await page.keyboard.press('Enter')
            }
          }
          // Wait for navigation to complete
          await navigationPromise
        }
      })()
    ])
    raceFinished = true

    if (userSkipped) {
      return { ok: false, status: 'skipped' }
    }

    // Check which element won the race
    const hasWrongCaptcha = await page.$('text=Vui lòng nhập đúng mã xác nhận')
    if (hasWrongCaptcha && await hasWrongCaptcha.isVisible()) {
      onLog('GDT returned "Vui lòng nhập đúng mã xác nhận!" (Incorrect CAPTCHA). Refreshing and retrying...')
      // GDT reloads the page on incorrect CAPTCHA, so the new CAPTCHA is already loaded.
      // We just wait 500ms for the browser to render it, then continue.
      await page.waitForTimeout(500)
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
      onLog('CAPTCHA incorrect or timeout occurred. Refreshing and retrying...')

      const captchaImg = await page.$('img[src*="captcha"]')
      if (captchaImg) {
        await captchaImg.click()
        await page.waitForTimeout(1000)
      }

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
