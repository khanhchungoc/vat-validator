export default function DuplicateWarning({ duplicates, onRemove, onProceed }) {
  if (!duplicates || duplicates.length === 0) return null

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>⚠️ Phát hiện hóa đơn trùng lặp</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: '0.9rem' }}>
          Các mã hóa đơn sau đã tồn tại trong hàng đợi. Vui lòng loại bỏ hoặc tiếp tục.
        </p>
        <ul style={{ marginBottom: 20, paddingLeft: 20 }}>
          {duplicates.map(id => (
            <li key={id} style={{ color: 'var(--skip)', marginBottom: 4, fontSize: '0.9rem' }}>
              {id}
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onRemove}>Loại bỏ trùng lặp</button>
          <button className="btn-primary" onClick={onProceed}>Vẫn tiếp tục</button>
        </div>
      </div>
    </div>
  )
}
