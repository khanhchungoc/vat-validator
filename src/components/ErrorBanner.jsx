export default function ErrorBanner({ error, onRetry, onSkip }) {
  if (!error) return null

  return (
    <div className="error-banner">
      <div className="error-banner-content">
        <span className="error-icon">⚠️</span>
        <div>
          <strong>Đang tạm dừng xử lý</strong>
          <p>{error}</p>
        </div>
      </div>
      <div className="error-banner-actions">
        <button className="btn-secondary" onClick={onSkip}>Bỏ qua hóa đơn</button>
        <button className="btn-primary" onClick={onRetry}>Thử lại</button>
      </div>
    </div>
  )
}
