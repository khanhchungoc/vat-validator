const { addInvoice } = require('./invoiceStore')

function handleMessage(ws, msg, wss) {
  console.log('[WS] Received:', msg.type)
  switch (msg.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }))
      break
    case 'add-manual-invoice': {
      const { invoiceCode, invoiceNumber, sellerName, taxId, sellerAddress, totalAmount } = msg.payload
      const missing = []
      if (!invoiceCode) missing.push('invoiceCode')
      if (!invoiceNumber) missing.push('invoiceNumber')
      if (!sellerName) missing.push('sellerName')
      if (!taxId) missing.push('taxId')
      if (!totalAmount) missing.push('totalAmount')

      if (missing.length > 0) {
        ws.send(JSON.stringify({ type: 'error', payload: `Missing fields: ${missing.join(', ')}` }))
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
        totalAmount: Number(totalAmount),
        status: 'pending'
      }

      const result = addInvoice(invoice)
      if (!result.ok) {
        ws.send(JSON.stringify({ type: 'error', payload: result.error }))
      } else {
        ws.send(JSON.stringify({ type: 'invoice-added', payload: invoice }))
      }
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
