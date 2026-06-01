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

  // Close the annoying "CỤC THUẾ THÔNG BÁO" modal if it pops up and blocks the screen
  try {
    const closeBtn = await page.$('.ant-modal-close')
    if (closeBtn) {
      await closeBtn.click()
      await page.waitForTimeout(500) // Wait for modal fade out animation
    }
  } catch (err) {
    // Ignore if modal doesn't appear
  }

  // Fill form fields
  // 1. Seller Tax ID
  await page.fill('input#nbmst, input[name="mstNban"], input[placeholder*="người bán"], input[id*="mstNban"]', invoice.taxId)

  // 2. Ensure "Hóa đơn giá trị gia tăng" (VAT, first option) is selected in dropdown
  try {
    const selectEl = await page.$('div#lhdon, #lhdon, .ant-select')
    if (selectEl) {
      await selectEl.click()
      await page.waitForTimeout(300)
      const optionEl = await page.$('.ant-select-dropdown-menu-item:has-text("giá trị gia tăng"), .ant-select-item-option-content:has-text("giá trị gia tăng")')
      if (optionEl) {
        await optionEl.click()
      } else {
        const firstItem = await page.$('.ant-select-dropdown-menu-item, .ant-select-item-option')
        if (firstItem) await firstItem.click()
      }
      await page.waitForTimeout(300)
    }
  } catch (err) {
    // Ignore and proceed with default selection
  }

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
        await page.waitForTimeout(500) // Wait for modal fade out animation
      }
    } catch (err) {}

    // Capture CAPTCHA image
    const captchaEl = await page.$('img[src*="captcha"], img[alt*="captcha"], img[id*="captcha"]')
    if (!captchaEl) throw new Error('CAPTCHA element not found on Site 1')

    // Scroll the first captcha piece into view
    await captchaEl.scrollIntoViewIfNeeded()

    // Wait for image bytes to arrive
    await page.waitForFunction(
      el => el.complete && el.naturalWidth > 0 && el.naturalHeight > 0,
      captchaEl,
      { timeout: 10000 }
    ).catch(() => {})

    // Give the browser time to fully paint all image pieces
    await new Promise(r => setTimeout(r, 800))

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

    // Ask frontend for answer (may return null if user skipped)
    const answer = await onCaptcha(captchaBase64, attempt)
    if (answer === null) {
      return { ok: false, status: 'skipped' }
    }

    // Set up network response listener for the guest-invoices API call
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/api/sco-query/guest-invoices'),
      { timeout: 30000 }
    ).catch(() => null)

    // Fill and submit CAPTCHA
    await page.fill('input#cvalue, input[name="captcha"], input[id*="captcha"]', answer)
    await page.click('button[type="submit"], input[type="submit"], button:has-text("Tìm kiếm")')

    const response = await responsePromise

    if (!response) {
      // Fallback: if timeout or network issue occurs, check if form is still visible
      const formIsStillVisible = await page.$('input#cvalue')
      if (formIsStillVisible && await formIsStillVisible.isVisible()) {
        continue
      }
      break
    }

    // 1. Check for incorrect CAPTCHA (HTTP 401 Unauthorized)
    if (response.status() === 401) {
      console.log(`[Site 1] Incorrect CAPTCHA submitted (attempt ${attempt}). Retrying...`)
      continue
    }

    // 2. Check for successful response (HTTP 200 OK)
    if (response.status() === 200) {
      const text = await response.text().catch(() => '')
      let body = null
      try {
        body = text ? JSON.parse(text) : null
      } catch (e) {
        console.error('[Site 1] Failed to parse API response JSON:', e.message)
      }

      // If the body is null or represents an empty object/array, the invoice does not exist
      if (!body || Object.keys(body).length === 0) {
        console.log(`[Site 1] Invoice not found via API.`)
        // Wait for UI to render the "Không tìm thấy" error message
        await page.waitForSelector('text=Không tìm thấy, text=không hợp lệ, .result-error', { timeout: 5000 }).catch(() => {})
        
        const screenshotBuffer = await page.screenshot({ fullPage: false })
        const screenshotBase64 = screenshotBuffer.toString('base64')
        return { ok: true, screenshotBase64, status: 'invalid-invoice' }
      } else {
        console.log(`[Site 1] Invoice verified successfully via API.`)
        // Wait for UI to render the "Tồn tại hóa đơn" success message
        await page.waitForSelector('text=Tồn tại hóa đơn có thông tin trùng khớp, .result-success', { timeout: 5000 }).catch(() => {})
        
        const screenshotBuffer = await page.screenshot({ fullPage: false })
        const screenshotBase64 = screenshotBuffer.toString('base64')
        return { ok: true, screenshotBase64, status: 'pass' }
      }
    }

    // If other status code, fallback to DOM check
    const formIsStillVisible = await page.$('input#cvalue')
    if (formIsStillVisible && await formIsStillVisible.isVisible()) {
      continue
    }
    break
  }

  // Fallback: If we broke out of the loop (e.g. captcha was accepted but the API response timed out or failed),
  // perform standard DOM-based verification checks and return a valid result.
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  const screenshotBuffer = await page.screenshot({ fullPage: false })
  const screenshotBase64 = screenshotBuffer.toString('base64')

  // Determine pass/fail status from page content
  const isInvalid = await page.$('text=Không tìm thấy, text=không hợp lệ, .result-error')
  const status = isInvalid ? 'invalid-invoice' : 'pass'

  return { ok: true, screenshotBase64, status }
}

module.exports = { runSite1 }
