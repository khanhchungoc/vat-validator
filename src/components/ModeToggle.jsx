export default function ModeToggle({ mode, onChange, disabled }) {
  return (
    <div className="mode-toggle">
      <span className="mode-label">Processing Mode:</span>
      <div className="mode-options">
        <button
          className={`mode-btn ${mode === 'auto' ? 'active' : ''}`}
          onClick={() => onChange('auto')}
          disabled={disabled}
          title="Process all invoices continuously"
        >
          ▶ Auto
        </button>
        <button
          className={`mode-btn ${mode === 'step' ? 'active' : ''}`}
          onClick={() => onChange('step')}
          disabled={disabled}
          title="Pause after each invoice for review"
        >
          👣 Step
        </button>
      </div>
    </div>
  )
}
