export default function ProgressBar({ invoices }) {
  if (invoices.length === 0) return null

  const done = invoices.filter(i => !['pending', 'processing'].includes(i.status)).length
  const total = invoices.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const passed = invoices.filter(i => i.status === 'pass').length
  const failed = invoices.filter(i => ['invalid-invoice', 'invalid-business'].includes(i.status)).length
  const skipped = invoices.filter(i => i.status === 'skipped').length

  return (
    <div className="progress-container">
      <div className="progress-header">
        <span className="progress-label">{done} / {total} invoices processed</span>
        <span className="progress-pct">{pct}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="progress-stats">
        <span style={{ color: 'var(--pass)' }}>✅ {passed} Pass</span>
        <span style={{ color: 'var(--fail)' }}>❌ {failed} Failed</span>
        <span style={{ color: 'var(--skip)' }}>⚠️ {skipped} Skipped</span>
      </div>
    </div>
  )
}
