import { useState } from 'react'

export default function CaptchaModal({ imageBase64, attempt, onSubmit, onSkip }) {
  const [answer, setAnswer] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!answer.trim()) return
    onSubmit(answer.trim())
    setAnswer('')
  }

  return (
    <div className="modal-overlay">
      <div className="modal captcha-modal">
        <h3>CAPTCHA Required</h3>
        {attempt > 1 && <p className="error">Wrong answer - please try again (attempt {attempt})</p>}
        <img
          src={`data:image/png;base64,${imageBase64}`}
          alt="CAPTCHA"
          className="captcha-image"
        />
        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            type="text"
            className="mock-input"
            placeholder="Type the CAPTCHA text..."
            value={answer}
            onChange={e => setAnswer(e.target.value)}
          />
          <div className="modal-actions">
            <button type="button" className="btn-skip" onClick={onSkip}>
              Skip Invoice
            </button>
            <button type="submit" className="btn-primary" disabled={!answer.trim()}>
              Submit {"->"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
