export default function ErrorBanner({ error, onRetry, onSkip }) {
  if (!error) return null

  return (
    <div className="error-banner">
      <div className="error-banner-content">
        <span className="error-icon">⚠️</span>
        <div>
          <strong>Processing Paused</strong>
          <p>{error}</p>
        </div>
      </div>
      <div className="error-banner-actions">
        <button className="btn-secondary" onClick={onSkip}>Skip Invoice</button>
        <button className="btn-primary" onClick={onRetry}>Retry</button>
      </div>
    </div>
  )
}
