import { useState, useCallback } from 'react'
import { useWebSocket } from './useWebSocket'
import DropZone from './components/DropZone'
import ManualEntryForm from './components/ManualEntryForm'
import InvoiceQueue from './components/InvoiceQueue'
import CaptchaModal from './components/CaptchaModal'
import ResumePanel from './components/ResumePanel'

export default function App() {
  const [invoices, setInvoices] = useState([])
  const [showManualForm, setShowManualForm] = useState(false)
  const [captchaData, setCaptchaData] = useState(null)
  const [wsStatus, setWsStatus] = useState('Connecting...')
  const [currentSessionDir, setCurrentSessionDir] = useState(null)

  const handleWsMessage = useCallback((msg) => {
    if (msg.type === 'ws-status') {
      setWsStatus(msg.payload)
    }
    if (msg.type === 'pong') {
      setWsStatus('Connected ✅')
    }
    if (msg.type === 'invoice-added') {
      setInvoices(prev => {
        // Prevent duplicate local additions just in case
        if (prev.some(i => i.id === msg.payload.id)) return prev
        return [...prev, msg.payload]
      })
    }
    if (msg.type === 'invoice-status') {
      setInvoices(prev => prev.map(inv => 
        inv.id === msg.payload.id ? { ...inv, ...msg.payload } : inv
      ))
      // Clear captcha if it was for this invoice
      setCaptchaData(prev => (prev && prev.id === msg.payload.id) ? null : prev)
    }
    if (msg.type === 'captcha-required') {
      setCaptchaData(msg.payload)
    }
    if (msg.type === 'error') {
      alert(msg.payload)
    }
  }, [])

  const { send } = useWebSocket(handleWsMessage)

  const handleFilesUploaded = useCallback((results) => {
    const added = results.filter(r => r.ok).map(r => r.invoice)
    const errors = results.filter(r => !r.ok)
    
    setInvoices(prev => {
      const filteredAdded = added.filter(newInv => !prev.some(oldInv => oldInv.id === newInv.id))
      return [...prev, ...filteredAdded]
    })
    
    if (errors.length > 0) {
      alert(errors.map(e => e.error).join('\n'))
    }
  }, [])

  const handleManualSubmit = useCallback((data) => {
    const sent = send({ type: 'add-manual-invoice', payload: data })
    if (sent) {
      setShowManualForm(false)
    } else {
      alert('Failed to send manual invoice: WebSocket is disconnected. Please check your connection and try again.')
    }
  }, [send])

  const handleCaptchaSubmit = useCallback((answer) => {
    if (!captchaData) return
    send({
      type: 'captcha-answer',
      payload: { id: captchaData.id, answer }
    })
  }, [send, captchaData])

  const handleSkipInvoice = useCallback(() => {
    if (!captchaData) return
    send({
      type: 'skip-invoice',
      payload: { id: captchaData.id }
    })
    setCaptchaData(null)
  }, [send, captchaData])

  const handleResume = useCallback(async (sessionDir) => {
    try {
      const res = await fetch('http://localhost:3001/sessions/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionDir })
      })
      const data = await res.json()
      if (res.ok) {
        setInvoices(data.invoices)
        setCurrentSessionDir(sessionDir)
      } else {
        alert(data.error || 'Failed to resume session')
      }
    } catch (e) {
      alert('Failed to resume session')
    }
  }, [])

  const handleStartProcessing = useCallback(async (mode = 'auto') => {
    let sessionDir = currentSessionDir
    if (!sessionDir) {
      try {
        const res = await fetch('http://localhost:3001/sessions/new', { method: 'POST' })
        const data = await res.json()
        if (res.ok) {
          sessionDir = data.sessionDir
          setCurrentSessionDir(sessionDir)
        } else {
          alert('Failed to create session: ' + (data.error || 'Unknown error'))
          return
        }
      } catch (e) {
        alert('Failed to create session')
        return
      }
    }
    send({ type: 'start-processing', payload: { sessionDir, mode } })
  }, [currentSessionDir, send])

  return (
    <div className="app">
      <header className="app-header">
        <h1>VATOCR</h1>
        <span className="ws-status">{wsStatus}</span>
      </header>
      <main className="app-main">
        <ResumePanel onResume={handleResume} />
        <DropZone onFilesUploaded={handleFilesUploaded} />
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button className="btn-primary" onClick={() => handleStartProcessing('auto')}>
            🚀 Start Batch
          </button>
          <button 
            className="btn-secondary" 
            onClick={() => setShowManualForm(true)}
          >
            + Add Invoice Manually
          </button>
        </div>
        <InvoiceQueue invoices={invoices} />
      </main>
      {showManualForm && (
        <ManualEntryForm
          onSubmit={handleManualSubmit}
          onClose={() => setShowManualForm(false)}
        />
      )}
      {captchaData && (
        <CaptchaModal
          imageBase64={captchaData.image}
          attempt={captchaData.attempt}
          onSubmit={handleCaptchaSubmit}
          onSkip={handleSkipInvoice}
        />
      )}
    </div>
  )
}

