import { useState, useEffect, useRef } from 'react'

export default function CaptchaModal({ imageBase64, attempt, onSubmit, onSkip }) {
  const [answer, setAnswer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef(null)

  // Reset loading state and clear input when a new CAPTCHA image or attempt arrives
  useEffect(() => {
    setIsSubmitting(false)
    setAnswer('')
    // Wait a brief tick to ensure input is re-enabled before trying to focus it
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [imageBase64, attempt])

  function handleSubmit(e) {
    e.preventDefault()
    if (!answer.trim() || isSubmitting) return
    setIsSubmitting(true)
    onSubmit(answer.trim())
  }

  return (
    <div className="modal-overlay">
      <div className="modal captcha-modal">
        <h3>CAPTCHA Required</h3>
        
        {/* Error warning shown when a previous attempt has failed and we are not currently verifying */}
        {attempt > 1 && !isSubmitting && (
          <p className="error" style={{ color: 'var(--fail)', fontWeight: '500', marginBottom: 16 }}>
            ❌ Incorrect CAPTCHA. Please try again (Attempt {attempt})
          </p>
        )}
        
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img
            src={`data:image/png;base64,${imageBase64}`}
            alt="CAPTCHA"
            className="captcha-image"
            style={{ 
              opacity: isSubmitting ? 0.5 : 1, 
              transition: 'opacity 0.2s',
              display: 'block',
              margin: '0 auto 20px'
            }}
          />
          {isSubmitting && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingBottom: 20
            }}>
              {/* Spinner indicator */}
              <div style={{
                width: 24,
                height: 24,
                border: '3px solid var(--glass-border)',
                borderTop: '3px solid var(--accent)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            autoFocus
            type="text"
            className="mock-input"
            placeholder={isSubmitting ? "Verifying..." : "Type the CAPTCHA text..."}
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            disabled={isSubmitting}
            style={{
              textAlign: 'center',
              letterSpacing: '2px',
              fontWeight: '600',
              fontSize: '1.1rem',
              background: isSubmitting ? 'rgba(255, 255, 255, 0.02)' : 'var(--glass)',
              cursor: isSubmitting ? 'not-allowed' : 'text'
            }}
          />
          
          {isSubmitting && (
            <div style={{ 
              marginTop: 12, 
              fontSize: '0.85rem', 
              color: 'var(--text-muted)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: 8 
            }}>
              <span>⏳ Verifying CAPTCHA, please wait...</span>
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: 24 }}>
            <button 
              type="button" 
              className="btn-skip" 
              onClick={onSkip}
              disabled={isSubmitting}
              style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
            >
              Skip Invoice
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={!answer.trim() || isSubmitting}
              style={{ 
                cursor: (isSubmitting || !answer.trim()) ? 'not-allowed' : 'pointer',
                minWidth: '120px'
              }}
            >
              {isSubmitting ? 'Verifying...' : 'Submit ->'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

