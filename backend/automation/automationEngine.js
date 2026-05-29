const { chromium } = require('playwright')
const { runSite1 } = require('./site1')
const { runSite2 } = require('./site2')
const { getInvoices, updateInvoiceStatus } = require('../invoiceStore')
const fs = require('fs')
const path = require('path')

let browser = null
let isRunning = false
let stepMode = false
let stepResolve = null        // Resolved when user clicks "Step ->"
let captchaResolve = null     // Resolved when user submits CAPTCHA answer or skips
let currentSessionDir = null
let broadcastFn = null        // Set by wsHandler: (msg) => void

function setBroadcast(fn) { broadcastFn = fn }

function broadcast(msg) {
  if (broadcastFn) broadcastFn(msg)
}

function saveScreenshot(sessionDir, invoiceId, site, base64Data) {
  const screenshotsDir = path.join(sessionDir, 'screenshots')
  fs.mkdirSync(screenshotsDir, { recursive: true })
  const filename = `${invoiceId.replace(/[^a-z0-9]/gi, '_')}_site${site}.png`
  fs.writeFileSync(path.join(screenshotsDir, filename), Buffer.from(base64Data, 'base64'))
  return filename
}

async function waitForCaptchaAnswer(invoiceId, base64Image, attempt) {
  broadcast({ type: 'captcha-required', payload: { id: invoiceId, image: base64Image, attempt } })
  return new Promise((resolve) => { captchaResolve = resolve })
}

async function waitForStep() {
  if (!stepMode) return
  broadcast({ type: 'step-waiting' })
  return new Promise((resolve) => { stepResolve = resolve })
}

function submitCaptchaAnswer(answer) {
  if (captchaResolve) { captchaResolve(answer); captchaResolve = null }
}

function skipInvoice() {
  if (captchaResolve) { captchaResolve(null); captchaResolve = null }
}

function advanceStep() {
  if (stepResolve) { stepResolve(); stepResolve = null }
}

async function startProcessing(sessionDir, mode = 'auto') {
  if (isRunning) {
    broadcast({ type: 'error', payload: 'Automation engine is already running' })
    return { ok: false, error: 'Already running' }
  }
  isRunning = true
  stepMode = mode === 'step'
  currentSessionDir = sessionDir

  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()

    const invoices = getInvoices().filter(i => i.status === 'pending')

    for (const invoice of invoices) {
      if (!isRunning) break // Check if stopped manually

      updateInvoiceStatus(invoice.id, 'processing')
      broadcast({ type: 'invoice-status', payload: { id: invoice.id, status: 'processing' } })

      let finalStatus = 'pass'
      let site1Screenshot = null
      let site2Screenshot = null

      try {
        // Site 1
        const site1Result = await runSite1(page, invoice, (img, att) => waitForCaptchaAnswer(invoice.id, img, att))
        if (site1Result.status === 'skipped') {
          finalStatus = 'skipped'
        } else {
          site1Screenshot = saveScreenshot(sessionDir, invoice.id, 1, site1Result.screenshotBase64)
          if (site1Result.status === 'invalid-invoice') {
            finalStatus = 'invalid-invoice'
          } else {
            // Site 2 (only if Site 1 passed)
            const site2Result = await runSite2(page, invoice)
            site2Screenshot = saveScreenshot(sessionDir, invoice.id, 2, site2Result.screenshotBase64)
            if (site2Result.status === 'invalid-business') finalStatus = 'invalid-business'
          }
        }
      } catch (e) {
        console.error(`[Engine] Error on invoice ${invoice.id}:`, e.message)
        broadcast({ type: 'error', payload: `Error processing ${invoice.id}: ${e.message}` })
        finalStatus = 'skipped'
      }

      updateInvoiceStatus(invoice.id, finalStatus, { site1Screenshot, site2Screenshot })
      broadcast({ type: 'invoice-status', payload: { id: invoice.id, status: finalStatus, site1Screenshot, site2Screenshot } })

      await waitForStep()
    }
    return { ok: true }
  } catch (e) {
    console.error('[Engine] Fatal error:', e.message)
    broadcast({ type: 'error', payload: `Fatal error: ${e.message}` })
    return { ok: false, error: e.message }
  } finally {
    if (browser) await browser.close()
    browser = null
    isRunning = false
    captchaResolve = null
    stepResolve = null
    currentSessionDir = null
    broadcast({ type: 'batch-complete' })
  }
}

async function stopProcessing() {
  if (!isRunning) return
  console.log('[Engine] Stopping processing...')
  isRunning = false
  if (browser) {
    await browser.close()
    browser = null
  }
  if (captchaResolve) { captchaResolve(null); captchaResolve = null }
  if (stepResolve) { stepResolve(); stepResolve = null }
}

function pauseProcessing() {
  stepMode = true
  broadcast({ type: 'mode-changed', payload: 'step' })
}

function resumeProcessing() {
  stepMode = false
  if (stepResolve) advanceStep()
  broadcast({ type: 'mode-changed', payload: 'auto' })
}

function getIsRunning() {
  return isRunning
}

module.exports = { startProcessing, stopProcessing, submitCaptchaAnswer, skipInvoice, advanceStep, pauseProcessing, resumeProcessing, setBroadcast, getIsRunning }
