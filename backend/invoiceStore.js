// In-memory store for the current session's invoice queue.
// Replaced/cleared on new session start. Persisted via sessionManager (Plan 4).

let invoices = []

function addInvoice(invoice) {
  // Prevent duplicates by id
  if (invoices.find(i => i.id === invoice.id)) {
    return { ok: false, error: `Duplicate invoice ID: ${invoice.id}` }
  }
  invoices.push(invoice)
  return { ok: true }
}

function getInvoices() {
  return [...invoices]
}

function updateInvoiceStatus(id, status, extra = {}) {
  const inv = invoices.find(i => i.id === id)
  if (!inv) return false
  Object.assign(inv, { status, ...extra })
  return true
}

function clearInvoices() {
  invoices = []
}

function loadInvoices(list) {
  invoices = list
}

module.exports = { addInvoice, getInvoices, updateInvoiceStatus, clearInvoices, loadInvoices }
