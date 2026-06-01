import { useEffect } from 'react'

export default function CaptchaModal({ imageBase64, attempt, onSkip }) {
  return (
    <div className="modal-overlay">
      <div className="modal captcha-modal" style={{ textAlign: 'center', padding: '24px 30px' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          🔑 CAPTCHA Solve Required
        </h3>
        
        <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: 20 }}>
          Please click on the <strong>opened browser window</strong>, type the CAPTCHA text directly into GDT's input field, and submit.
        </p>

        {attempt > 1 && (
          <p className="error" style={{ color: 'var(--fail)', fontWeight: '600', marginBottom: 16, fontSize: '0.85rem' }}>
            ❌ Incorrect CAPTCHA entered. Please try GDT's refreshed code (Attempt {attempt})
          </p>
        )}
        
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)', display: 'inline-block', marginBottom: 24 }}>
          <img
            src={`data:image/png;base64,${imageBase64}`}
            alt="CAPTCHA Hint"
            className="captcha-image"
            style={{ 
              display: 'block',
              margin: '0 auto',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: 10 }}>
            Image copy for reference
          </span>
        </div>

        <div style={{ fontSize: '0.85rem', color: '#60a5fa', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#60a5fa', animation: 'console-indicator-pulse 1.5s infinite' }} />
          <span>Waiting for your submission in GDT browser window...</span>
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
