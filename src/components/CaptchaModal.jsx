import { useEffect, useState, useRef } from 'react'

export default function CaptchaModal({ imageBase64, attempt, onSubmit, onSkip }) {
  const [answer, setAnswer] = useState('')
  const inputRef = useRef(null)

  // Auto-focus the input box whenever the modal appears
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [imageBase64])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!answer.trim()) return
    onSubmit(answer.trim())
    setAnswer('')
  }

  return (
    <div className="modal-overlay">
      <div className="modal captcha-modal" style={{ textAlign: 'center', padding: '24px 30px' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          🔑 CAPTCHA Solve Required
        </h3>
        
        <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: 20 }}>
          Enter the CAPTCHA below, or click directly on the <strong>opened browser window</strong> to solve it on the site.
        </p>

        {attempt > 1 && (
          <p className="error" style={{ color: 'var(--fail)', fontWeight: '600', marginBottom: 16, fontSize: '0.85rem' }}>
            ❌ Incorrect CAPTCHA entered. Please try GDT's refreshed code (Attempt {attempt})
          </p>
        )}
        
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)', display: 'inline-block', marginBottom: 24 }}>
          <img
            src={`data:image/png;base64,${imageBase64}`}
            alt="CAPTCHA Hint"
            className="captcha-image"
            style={{ 
              display: 'block',
              margin: '0 auto',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              width: '240px',
              height: 'auto'
            }}
          />
        </div>

        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '280px', margin: '0 auto 24px auto' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              autoFocus
              type="text"
              placeholder="Enter CAPTCHA..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--panel-border)',
                background: 'var(--panel-bg)',
                color: 'var(--text-main)',
                fontSize: '0.95rem',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={!answer.trim()}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Verify
            </button>
          </div>
        </form>

        <div style={{ fontSize: '0.85rem', color: '#60a5fa', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#60a5fa', animation: 'console-indicator-pulse 1.5s infinite' }} />
          <span>Or solve directly in the GDT browser window...</span>
        </div>

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'center' }}>
          <button 
            type="button" 
            className="btn-skip" 
            onClick={onSkip}
            style={{ width: '100%', maxWidth: '200px' }}
          >
            Skip Invoice
          </button>
        </div>
      </div>
    </div>
  )
}
