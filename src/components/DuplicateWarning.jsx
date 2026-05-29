export default function DuplicateWarning({ duplicates, onRemove, onProceed }) {
  if (!duplicates || duplicates.length === 0) return null

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>⚠️ Duplicate Invoices Detected</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: '0.9rem' }}>
          The following invoice IDs already exist in the queue. Remove them or proceed anyway.
        </p>
        <ul style={{ marginBottom: 20, paddingLeft: 20 }}>
          {duplicates.map(id => (
            <li key={id} style={{ color: 'var(--skip)', marginBottom: 4, fontSize: '0.9rem' }}>
              {id}
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onRemove}>Remove Duplicates</button>
          <button className="btn-primary" onClick={onProceed}>Proceed Anyway</button>
        </div>
      </div>
    </div>
  )
}
