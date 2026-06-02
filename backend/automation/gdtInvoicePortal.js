const SITE1_URL = 'https://hoadondientu.gdt.gov.vn/'

const JITTER_FACTOR = 0.07

/**
 * Generate a randomized delay with ±7% dynamic timing jitter to bypass bot heuristics.
 * @param {number} baseMs - The base delay in milliseconds
 * @returns {number} The randomized delay
 */
function getRandomDelay(baseMs) {
  const jitter = Math.round(baseMs * JITTER_FACTOR) // 7% dynamic jitter
  const min = baseMs - jitter
  const max = baseMs + jitter
  return Math.floor(Math.random() * (max - min + 1)) + min
}


/**
 * Run GDT Invoice Portal lookup for a single invoice.
 * @param {import('playwright').Page} page
 * @param {object} invoice - { invoiceCode, invoiceNumber, totalAmount }
 * @param {function} onCaptcha - async (base64Image, attempt) => string|null
 * @returns {{ ok: boolean, screenshotBase64?: string, status: 'pass'|'invalid-invoice'|'skipped' }}
 */
async function runGdtInvoicePortal(page, invoice, onCaptcha, onLog = () => {}) {
  const currentUrl = page.url()
  if (!currentUrl.includes('hoadondientu.gdt.gov.vn')) {
    onLog('Navigating to GDT Portal (https://hoadondientu.gdt.gov.vn/)...')
    await page.goto(SITE1_URL, { waitUntil: 'networkidle', timeout: 30000 })

    // Close the annoying "CỤC THUẾ THÔNG BÁO" modal if it pops up and blocks the screen
    try {
      const closeBtn = await page.$('.ant-modal-close')
      if (closeBtn) {
        onLog('Bypassing announcement popup...')
        await closeBtn.click()
        await page.waitForTimeout(getRandomDelay(500)) // Wait for modal fade out animation
      }
    } catch (err) {}
  } else {
    onLog('Already on GDT Portal. Resetting form fields for new query...')
    
    // Save current captcha src before refresh so we can wait for the change
    const oldSrc = await page.evaluate(() => {
      const img = document.querySelector('img[src*="captcha"], img[alt*="captcha"], img[id*="captcha"]')
      return img ? img.getAttribute('src') : null
    })

    // Clear fields
    await page.fill('input#nbmst', '')
    await page.fill('input#khhdon', '')
    await page.fill('input#shdon', '')
    await page.fill('input#tgtttbso', '')
    await page.fill('input#cvalue', '')

    // Refresh CAPTCHA
    const refreshBtn = await page.$('button.ant-btn-icon-only:visible')
    if (refreshBtn) {
      await refreshBtn.click()
      // Wait for captcha src to update
      await page.waitForFunction(
        (prevSrc) => {
          const img = document.querySelector('img[src*="captcha"], img[alt*="captcha"], img[id*="captcha"]')
          return img && img.getAttribute('src') !== prevSrc
        },
        oldSrc,
        { timeout: 10000 }
      ).catch(() => {})
    }
  }

  onLog(`Filling invoice details: Seller Tax ID (${invoice.taxId}), Code, Number, Amount...`)
  // Fill form fields
  // 1. Seller Tax ID
  await page.fill('input#nbmst, input[name="mstNban"], input[placeholder*="người bán"], input[id*="mstNban"]', invoice.taxId)

  // 2. Ensure "Hóa đơn giá trị gia tăng" (VAT, first option) is selected in dropdown
  try {
    const selectEl = await page.$('div#lhdon, #lhdon, .ant-select')
    if (selectEl) {
      await selectEl.click()
      await page.waitForTimeout(getRandomDelay(300))
      const optionEl = await page.$('.ant-select-dropdown-menu-item:has-text("giá trị gia tăng"), .ant-select-item-option-content:has-text("giá trị gia tăng")')
      if (optionEl) {
        await optionEl.click()
      } else {
        const firstItem = await page.$('.ant-select-dropdown-menu-item, .ant-select-item-option')
        if (firstItem) await firstItem.click()
      }
      await page.waitForTimeout(getRandomDelay(300))
    }
  } catch (err) {}

  // 3. Invoice Code, Number, and Amount
  await page.fill('input#khhdon, input[name="khhdon"], input[placeholder*="ký hiệu"], input[id*="khhdon"]', invoice.invoiceCode)
  await page.fill('input#shdon, input[name="shdon"], input[placeholder*="số hóa đơn"], input[id*="shdon"]', String(invoice.invoiceNumber))
  await page.fill('input#tgtttbso, input[name="tgtttbso"], input[placeholder*="tổng tiền"], input[id*="tgtttbso"]', String(invoice.totalAmount))

  let attempt = 0
  while (true) {
    attempt++
    // Close the annoying modal if it popped up late or during a retry
    try {
      const closeBtn = await page.$('.ant-modal-close')
      if (closeBtn && await closeBtn.isVisible()) {
        await closeBtn.click()
        await page.waitForTimeout(getRandomDelay(500)) // Wait for modal fade out animation
      }
    } catch (err) {}

    onLog(`Capturing CAPTCHA image (attempt ${attempt})...`)
    // Capture CAPTCHA image
    const captchaEl = await page.$('img[src*="captcha"], img[alt*="captcha"], img[id*="captcha"]')
    if (!captchaEl) throw new Error('CAPTCHA element not found on GDT Invoice Portal')

    // Scroll the first captcha piece into view
    await captchaEl.scrollIntoViewIfNeeded()

    // Wait for image bytes to arrive
    await page.waitForFunction(
      el => el.complete && el.naturalWidth > 0 && el.naturalHeight > 0,
      captchaEl,
      { timeout: 10000 }
    ).catch(() => {})

    // Give the browser time to fully paint all image pieces
    await new Promise(r => setTimeout(r, getRandomDelay(800)))

    // The CAPTCHA may be split across multiple img elements.
    // Compute the union bounding box covering ALL of them so we capture the full image.
    const captchaBox = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img[src*="captcha"], img[alt*="captcha"], img[id*="captcha"]')
      if (imgs.length === 0) return null
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      imgs.forEach(img => {
        const r = img.getBoundingClientRect()
        minX = Math.min(minX, r.left)
        minY = Math.min(minY, r.top)
        maxX = Math.max(maxX, r.right)
        maxY = Math.max(maxY, r.bottom)
      })
      return minX === Infinity ? null : { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    })

    const captchaBuffer = captchaBox
      ? await page.screenshot({ clip: captchaBox })
      : await captchaEl.screenshot()
    const captchaBase64 = captchaBuffer.toString('base64')

    onLog('Please solve the CAPTCHA directly in GDT\'s opened browser window...')

    // Focus GDT's input field so they can immediately type without clicking it!
    try {
      await page.focus('input#cvalue')
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
      console.error('[GDT Invoice Portal] CAPTCHA solving failed:', err.message)
      userSkipped = true
      resolveAnswerSubmitted()
    })

    // Race GDT's API response directly (user solved directly in browser)
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/api/sco-query/guest-invoices'),
      { timeout: 600000 } // 10 minutes timeout
    ).catch(() => null)

    const response = await Promise.race([
      responsePromise,
      (async () => {
        await answerSubmittedPromise
        if (raceFinished) return null
        if (userSkipped) return null
        if (electronAnswer) {
          onLog(`Typing CAPTCHA answer "${electronAnswer}" into GDT portal...`)
          // Clear and focus GDT's input field
          await page.fill('input#cvalue', '')
          await page.focus('input#cvalue')
          // Simulate human typing with character-by-character randomized delays (50ms to 150ms)
          for (const char of electronAnswer) {
            const delay = Math.floor(Math.random() * (150 - 50 + 1)) + 50
            await page.keyboard.type(char, { delay })
          }
          // Human muscle transition delay before hitting enter (500ms)
          await page.waitForTimeout(getRandomDelay(500))
          // Press Enter to submit GDT's form
          await page.keyboard.press('Enter')
          // Wait for response to finish
          return await responsePromise
        }
        return null
      })()
    ])
    raceFinished = true

    if (userSkipped || !response) {
      return { ok: false, status: 'skipped' }
    }

    // 1. Check for incorrect CAPTCHA (HTTP 401 Unauthorized)
    if (response.status() === 401) {
      onLog('GDT returned HTTP 401 (Incorrect CAPTCHA). Refreshing and retrying...')
      console.log(`[GDT Invoice Portal] Incorrect CAPTCHA submitted (attempt ${attempt}). Retrying...`)

      // Wait for captcha src to actually change to prevent screenshotting the old CAPTCHA
      const oldCaptchaSrc = await page.evaluate(() => {
        const img = document.querySelector('img[src*="captcha"], img[alt*="captcha"], img[id*="captcha"]')
        return img ? img.getAttribute('src') : null
      })
      await page.waitForFunction(
        (prevSrc) => {
          const img = document.querySelector('img[src*="captcha"], img[alt*="captcha"], img[id*="captcha"]')
          return img && img.getAttribute('src') !== prevSrc
        },
        oldCaptchaSrc,
        { timeout: 10000 }
      ).catch(() => {})

      continue
    }

    // 2. Check for successful response (HTTP 200 OK)
    if (response.status() === 200) {
      const text = await response.text().catch(() => '')
      let body = null
      try {
        body = text ? JSON.parse(text) : null
      } catch (e) {
        console.error('[GDT Invoice Portal] Failed to parse API response JSON:', e.message)
      }

      // If the body is null or represents an empty object/array, the invoice does not exist
      if (!body || Object.keys(body).length === 0) {
        onLog('GDT returned HTTP 200 (Invoice not found). Capturing error screenshot...')
        console.log(`[GDT Invoice Portal] Invoice not found via API.`)
        // Wait for UI to render the "Không tìm thấy" error message
        await page.locator('text=Không tìm thấy')
          .or(page.locator('text=không hợp lệ'))
          .or(page.locator('.result-error'))
          .waitFor({ state: 'visible', timeout: 5000 })
          .catch(() => {})
        
        const screenshotBuffer = await page.screenshot({ fullPage: false })
        const screenshotBase64 = screenshotBuffer.toString('base64')
        return { ok: true, screenshotBase64, status: 'invalid-invoice' }
      } else {
        onLog('GDT returned HTTP 200 (Invoice verified!). Capturing success screenshot...')
        console.log(`[GDT Invoice Portal] Invoice verified successfully via API.`)
        // Wait for UI to render the "Tồn tại hóa đơn" success message
        await page.locator('text=Tồn tại hóa đơn có thông tin trùng khớp')
          .or(page.locator('.result-success'))
          .waitFor({ state: 'visible', timeout: 5000 })
          .catch(() => {})
        
        const screenshotBuffer = await page.screenshot({ fullPage: false })
        const screenshotBase64 = screenshotBuffer.toString('base64')
        return { ok: true, screenshotBase64, status: 'pass' }
      }
    }

    break
  }

  // Fallback: If we broke out of the loop (e.g. captcha was accepted but the API response timed out or failed),
  // perform standard DOM-based verification checks and return a valid result.
  onLog('API response timed out or failed. Falling back to DOM verification checks...')
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  const screenshotBuffer = await page.screenshot({ fullPage: false })
  const screenshotBase64 = screenshotBuffer.toString('base64')

  // Determine pass/fail status from page content
  const isInvalid = await page.locator('text=Không tìm thấy')
    .or(page.locator('text=không hợp lệ'))
    .or(page.locator('.result-error'))
    .first()
    .isVisible()
    .catch(() => false)
  const status = isInvalid ? 'invalid-invoice' : 'pass'

  return { ok: true, screenshotBase64, status }
}

module.exports = { runGdtInvoicePortal }
