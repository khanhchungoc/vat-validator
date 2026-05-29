const STATUS_LABELS = {
  pending: { label: 'Pending', color: 'var(--text-muted)' },
  processing: { label: 'Processing...', color: 'var(--accent)' },
  pass: { label: '✅ Pass', color: 'var(--pass)' },
  'invalid-invoice': { label: '❌ Invalid Invoice', color: 'var(--fail)' },
  'invalid-business': { label: '❌ Invalid Business', color: 'var(--fail)' },
  skipped: { label: '⚠️ Skipped', color: 'var(--skip)' }
}

export default function InvoiceQueue({ invoices }) {
  if (invoices.length === 0) return null

  return (
    <div className="queue">
      <h3>Invoice Queue ({invoices.length})</h3>
      {invoices.map((inv) => {
        const s = STATUS_LABELS[inv.status] || STATUS_LABELS.pending
        return (
          <div key={inv.id} className={`invoice-card ${inv.status}`}>
            <div className="invoice-info">
              <span className="invoice-id">{inv.invoiceCode} / {inv.invoiceNumber}</span>
              <span className="invoice-seller">{inv.sellerName}</span>
              <span className="invoice-amount">
                {(() => {
                  const amount = typeof inv.totalAmount === 'number' ? inv.totalAmount : Number(inv.totalAmount)
                  return !isNaN(amount) && amount >= 0 ? amount.toLocaleString('vi-VN') : '0'
                })()} ₫
              </span>
            </div>
            <span className="invoice-status" style={{ color: s.color }}>{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}
