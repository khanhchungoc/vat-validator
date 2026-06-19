const STATUS_LABELS = {
  pending: { label: 'Đang chờ', color: 'var(--text-muted)' },
  processing: { label: 'Đang xử lý...', color: 'var(--accent)' },
  pass: { label: '✅ Hợp lệ', color: 'var(--pass)' },
  'invalid-invoice': { label: '❌ Hóa đơn không hợp lệ', color: 'var(--fail)' },
  'invalid-business': { label: '❌ DN không hoạt động', color: 'var(--fail)' },
  skipped: { label: '⚠️ Đã bỏ qua', color: 'var(--skip)' }
}

export default function InvoiceQueue({ invoices }) {
  if (invoices.length === 0) return null

  return (
    <div className="queue">
      <h3>Hàng đợi hóa đơn ({invoices.length})</h3>
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
