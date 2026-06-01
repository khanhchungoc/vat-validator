const { addInvoice, getInvoices, resetSkippedInvoices } = require('./invoiceStore')
const { saveSession } = require('./sessionManager')
const engine = require('./automation/automationEngine')

async function handleMessage(ws, msg, wss) {
  console.log('[WS] Received:', msg.type)
  switch (msg.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }))
      break
    case 'start-processing': {
      let { sessionDir, mode } = msg.payload || {}
      if (!sessionDir || typeof sessionDir !== 'string' || sessionDir.includes('..')) {
        ws.send(JSON.stringify({ type: 'error', payload: 'Invalid session directory' }))
        break
      }
      const result = await engine.startProcessing(sessionDir, mode)
      if (result && !result.ok) {
        ws.send(JSON.stringify({ type: 'error', payload: result.error }))
      }
      break
    }
    case 'stop-processing':
      await engine.stopProcessing()
      break
    case 'captcha-answer': {
      const { answer } = msg.payload || {}
      engine.submitCaptchaAnswer(answer)
      break
    }
    case 'skip-invoice':
      engine.skipInvoice()
      break
    case 'advance-step':
      engine.advanceStep()
      break
    case 'set-mode': {
      const { mode } = msg.payload || {}
      if (mode === 'paused') {
        engine.pauseProcessing()
      } else {
        engine.resumeProcessing()
      }
      break
    }
    case 'add-manual-invoice': {
      const { invoiceCode, invoiceNumber, sellerName, taxId, sellerAddress, totalAmount } = msg.payload || {}
      const missing = []
      if (!invoiceCode) missing.push('invoiceCode')
      if (!invoiceNumber) missing.push('invoiceNumber')
      if (!sellerName) missing.push('sellerName')
      if (!taxId) missing.push('taxId')
      if (totalAmount === undefined || totalAmount === null || totalAmount === '') {
        missing.push('totalAmount')
      }

      if (missing.length > 0) {
        ws.send(JSON.stringify({ type: 'error', payload: `Missing fields: ${missing.join(', ')}` }))
        break
      }

      const parsedAmount = Number(totalAmount)
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        ws.send(JSON.stringify({ type: 'error', payload: 'Invalid total amount' }))
        break
      }

      const invoice = {
        id: `${invoiceCode}-${invoiceNumber}`,
        source: 'manual',
        invoiceCode,
        invoiceNumber: String(invoiceNumber),
        sellerName,
        taxId,
        sellerAddress: sellerAddress || '',
        totalAmount: parsedAmount,
        status: 'pending'
      }

      const result = addInvoice(invoice)
      if (!result.ok) {
        ws.send(JSON.stringify({ type: 'error', payload: result.error }))
      } else {
        broadcast(wss, { type: 'invoice-added', payload: invoice })
      }
      break
    }
    case 'reset-skipped': {
      const { sessionDir } = msg.payload || {}
      const count = resetSkippedInvoices()
      if (count > 0 && sessionDir) {
        saveSession(sessionDir, getInvoices())
      }
      broadcast(wss, { type: 'invoices-reset', payload: getInvoices() })
      break
    }
    default:
      console.warn('[WS] Unknown message type:', msg.type)
  }
}

function broadcast(wss, msg) {
  const data = JSON.stringify(msg)
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(data)
  })
}

module.exports = { handleMessage, broadcast }
