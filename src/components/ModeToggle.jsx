export default function ModeToggle({ mode, onChange, disabled }) {
  return (
    <div className="mode-toggle">
      <span className="mode-label">Chế độ xử lý:</span>
      <div className="mode-options">
        <button
          className={`mode-btn ${mode === 'auto' ? 'active' : ''}`}
          onClick={() => onChange('auto')}
          disabled={disabled}
          title="Xử lý liên tục tất cả hóa đơn"
        >
          ▶ Tự động
        </button>
        <button
          className={`mode-btn ${mode === 'step' ? 'active' : ''}`}
          onClick={() => onChange('step')}
          disabled={disabled}
          title="Tạm dừng sau mỗi hóa đơn để kiểm tra"
        >
          👣 Từng bước
        </button>
      </div>
    </div>
  )
}
