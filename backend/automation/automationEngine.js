const { chromium } = require('playwright')
const { runGdtInvoicePortal } = require('./gdtInvoicePortal')
const { runGdtTaxpayerPortal } = require('./gdtTaxpayerPortal')
const { getInvoices, updateInvoiceStatus } = require('../invoiceStore')
const { saveSession } = require('../sessionManager')
const { generatePDF } = require('../output/pdfGenerator')
const { generateXLSX } = require('../output/xlsxGenerator')
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

function logStep(invoiceId, message) {
  console.log(`[LogStep] [${invoiceId}]: ${message}`)
  broadcast({
    type: 'processing-log',
    payload: {
      invoiceId,
      message,
      timestamp: new Date().toLocaleTimeString()
    }
  })
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

  // Clear client activity logs at start
  broadcast({ type: 'processing-log-clear' })

  try {
    browser = await chromium.launch({ 
      headless: false,
      args: ['--start-minimized']
    })
    const page = await browser.newPage()
    await page.setViewportSize({ width: 1280, height: 900 })

    const invoices = getInvoices().filter(i => i.status === 'pending')

    // ─────────────────────────────────────────────────────────
    // PHASE 1: GDT Invoice Portal — process all invoices first
    // ─────────────────────────────────────────────────────────
    // phase1Results maps invoiceId → { status, site1Screenshot }
    const phase1Results = {}

    for (const invoice of invoices) {
      if (!isRunning) break

      updateInvoiceStatus(invoice.id, 'processing')
      broadcast({ type: 'invoice-status', payload: { id: invoice.id, status: 'processing' } })
      saveSession(sessionDir, getInvoices())

      let site1Screenshot = null
      let site1Status = 'skipped'
      let processAttempt = 0
      const maxProcessAttempts = 3

      while (processAttempt < maxProcessAttempts) {
        processAttempt++
        try {
          const site1Result = await runGdtInvoicePortal(
            page,
            invoice,
            (img, att) => waitForCaptchaAnswer(invoice.id, img, att),
            (msg) => logStep(invoice.id, `[GDT Invoice Portal] ${msg}`)
          )
          site1Status = site1Result.status
          if (site1Result.status !== 'skipped') {
            broadcast({ type: 'captcha-success', payload: { id: invoice.id } })
            site1Screenshot = saveScreenshot(sessionDir, invoice.id, 1, site1Result.screenshotBase64)
          }
          break
        } catch (e) {
          console.error(`[Engine] Phase 1 error on invoice ${invoice.id} (attempt ${processAttempt}):`, e.message)
          broadcast({ type: 'processing-error', payload: { invoiceId: invoice.id, message: e.message } })
          const userChoice = await new Promise(resolve => { captchaResolve = resolve })
          if (userChoice === 'skip' || userChoice === null) {
            site1Status = 'skipped'
            break
          }
          if (processAttempt >= maxProcessAttempts) {
            site1Status = 'skipped'
            break
          }
        }
      }

      phase1Results[invoice.id] = { status: site1Status, site1Screenshot }

      // Invoices that didn't pass Site 1 are finalized now
      if (site1Status !== 'pass') {
        updateInvoiceStatus(invoice.id, site1Status, { site1Screenshot, site2Screenshot: null })
        broadcast({ type: 'invoice-status', payload: { id: invoice.id, status: site1Status, site1Screenshot, site2Screenshot: null } })
      } else {
        // Mark as intermediate so UI shows progress
        updateInvoiceStatus(invoice.id, 'site1-done', { site1Screenshot, site2Screenshot: null })
        broadcast({ type: 'invoice-status', payload: { id: invoice.id, status: 'site1-done', site1Screenshot, site2Screenshot: null } })
      }
      saveSession(sessionDir, getInvoices())

      await waitForStep()
    }

    // ─────────────────────────────────────────────────────────
    // PHASE 2: GDT Taxpayer Portal — one lookup per unique Tax ID
    // ─────────────────────────────────────────────────────────
    const passedInvoices = invoices.filter(inv => phase1Results[inv.id]?.status === 'pass')
    const uniqueTaxIds = [...new Set(passedInvoices.map(inv => inv.taxId))]

    // site2Cache maps taxId → { status, screenshotBase64 }
    const site2Cache = {}

    if (uniqueTaxIds.length > 0) {
      logStep('engine', 'Phase 1 complete. Starting Tax ID lookups on GDT Taxpayer Portal...')
    }

    for (const taxId of uniqueTaxIds) {
      if (!isRunning) break

      // Use first invoice with this Tax ID as representative for CAPTCHA prompting
      const representativeInvoice = passedInvoices.find(inv => inv.taxId === taxId)

      let site2Status = 'skipped'
      let site2ScreenshotBase64 = null
      let processAttempt = 0
      const maxProcessAttempts = 3

      while (processAttempt < maxProcessAttempts) {
        processAttempt++
        try {
          const site2Result = await runGdtTaxpayerPortal(
            page,
            representativeInvoice,
            (img, att) => waitForCaptchaAnswer(representativeInvoice.id, img, att),
            (msg) => logStep(representativeInvoice.id, `[GDT Taxpayer Portal] [TaxID: ${taxId}] ${msg}`)
          )
          site2Status = site2Result.status
          if (site2Result.status !== 'skipped') {
            broadcast({ type: 'captcha-success', payload: { id: representativeInvoice.id } })
            site2ScreenshotBase64 = site2Result.screenshotBase64
          }
          break
        } catch (e) {
          console.error(`[Engine] Phase 2 error on Tax ID ${taxId} (attempt ${processAttempt}):`, e.message)
          broadcast({ type: 'processing-error', payload: { invoiceId: representativeInvoice.id, message: e.message } })
          const userChoice = await new Promise(resolve => { captchaResolve = resolve })
          if (userChoice === 'skip' || userChoice === null) {
            site2Status = 'skipped'
            break
          }
          if (processAttempt >= maxProcessAttempts) {
            site2Status = 'skipped'
            break
          }
        }
      }

      site2Cache[taxId] = { status: site2Status, screenshotBase64: site2ScreenshotBase64 }
    }

    // Apply Phase 2 results: copy screenshot once per invoice that passed Phase 1
    for (const invoice of passedInvoices) {
      if (!isRunning) break
      const cached = site2Cache[invoice.taxId]
      const { site1Screenshot } = phase1Results[invoice.id]

      let site2Screenshot = null
      let finalStatus = cached?.status ?? 'skipped'

      if (cached && cached.screenshotBase64) {
        // Copy the screenshot buffer to this invoice's own file
        site2Screenshot = saveScreenshot(sessionDir, invoice.id, 2, cached.screenshotBase64)
      }

      updateInvoiceStatus(invoice.id, finalStatus, { site1Screenshot, site2Screenshot })
      broadcast({ type: 'invoice-status', payload: { id: invoice.id, status: finalStatus, site1Screenshot, site2Screenshot } })
      saveSession(sessionDir, getInvoices())
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

    let generated = false
    if (currentSessionDir) {
      saveSession(currentSessionDir, getInvoices())

      try {
        const allInvoices = getInvoices()
        if (allInvoices.length > 0) {
          const [pdfPath, xlsxPath] = await Promise.all([
            generatePDF(currentSessionDir, allInvoices),
            Promise.resolve(generateXLSX(currentSessionDir, allInvoices))
          ])
          const sessionId = require('path').basename(currentSessionDir)
          const port = process.env.BACKEND_PORT || '3001'
          broadcast({
            type: 'batch-complete',
            payload: {
              pdfUrl: `http://localhost:${port}/download/pdf/${sessionId}`,
              xlsxUrl: `http://localhost:${port}/download/xlsx/${sessionId}`
            }
          })
          generated = true
        }
      } catch (e) {
        console.error('[Engine] Output generation failed:', e.message)
      }
    }
    if (!generated) {
      broadcast({ type: 'batch-complete', payload: {} })
    }
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
