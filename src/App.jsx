import { useState, useCallback } from 'react'
import { useWebSocket } from './useWebSocket'
import DropZone from './components/DropZone'
import ManualEntryForm from './components/ManualEntryForm'
import InvoiceQueue from './components/InvoiceQueue'
import CaptchaModal from './components/CaptchaModal'
import ResumePanel from './components/ResumePanel'
import DownloadButtons from './components/DownloadButtons'

export default function App() {
  const [invoices, setInvoices] = useState([])
  const [showManualForm, setShowManualForm] = useState(false)
  const [captchaData, setCaptchaData] = useState(null)
  const [wsStatus, setWsStatus] = useState('Connecting...')
  const [currentSessionDir, setCurrentSessionDir] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingMode, setProcessingMode] = useState('auto')
  const [isStepWaiting, setIsStepWaiting] = useState(false)
  const [downloadUrls, setDownloadUrls] = useState({ pdfUrl: null, xlsxUrl: null })

  const handleWsMessage = useCallback((msg) => {
    if (msg.type === 'ws-status') {
      setWsStatus(msg.payload)
    }
    if (msg.type === 'pong') {
      setWsStatus('Connected ✅')
    }
    if (msg.type === 'invoice-added') {
      setInvoices(prev => {
        if (prev.some(i => i.id === msg.payload.id)) return prev
        return [...prev, msg.payload]
      })
    }
    if (msg.type === 'invoice-status') {
      setIsProcessing(true) // If we get status updates, we are processing
      setInvoices(prev => prev.map(inv => 
        inv.id === msg.payload.id ? { ...inv, ...msg.payload } : inv
      ))
      setCaptchaData(prev => (prev && prev.id === msg.payload.id) ? null : prev)
    }
    if (msg.type === 'captcha-required') {
      setCaptchaData(msg.payload)
    }
    if (msg.type === 'step-waiting') {
      setIsStepWaiting(true)
    }
    if (msg.type === 'batch-complete') {
      setIsProcessing(false)
      setIsStepWaiting(false)
      if (msg.payload?.pdfUrl) {
        setDownloadUrls({ pdfUrl: msg.payload.pdfUrl, xlsxUrl: msg.payload.xlsxUrl })
      } else {
        setDownloadUrls({ pdfUrl: null, xlsxUrl: null })
      }
    }
    if (msg.type === 'mode-changed') {
      setProcessingMode(msg.payload)
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
      alert('Failed to send manual invoice: WebSocket is disconnected.')
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
      setDownloadUrls({ pdfUrl: null, xlsxUrl: null })
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
    setDownloadUrls({ pdfUrl: null, xlsxUrl: null })
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
    setProcessingMode(mode)
    setIsProcessing(true)
    send({ type: 'start-processing', payload: { sessionDir, mode } })
  }, [currentSessionDir, send])

  const handleStopProcessing = useCallback(() => {
    send({ type: 'stop-processing' })
    setIsProcessing(false)
    setIsStepWaiting(false)
  }, [send])

  const handleAdvanceStep = useCallback(() => {
    send({ type: 'advance-step' })
    setIsStepWaiting(false)
  }, [send])

  const handleToggleMode = useCallback(() => {
    const newMode = processingMode === 'auto' ? 'paused' : 'auto'
    send({ type: 'set-mode', payload: { mode: newMode } })
    // Note: setProcessingMode is called by the ws message 'mode-changed'
  }, [send, processingMode])

  return (
    <div className="app">
      <header className="app-header">
        <h1>VATOCR</h1>
        <span className="ws-status">{wsStatus}</span>
      </header>
      <main className="app-main">
        {!currentSessionDir && invoices.length === 0 && (
          <ResumePanel onResume={handleResume} />
        )}
        
        <DropZone onFilesUploaded={handleFilesUploaded} disabled={isProcessing} />
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
          {!isProcessing ? (
            <>
              <button 
                className="btn-primary" 
                onClick={() => handleStartProcessing('auto')}
                disabled={invoices.length === 0}
              >
                🚀 Start Batch
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => handleStartProcessing('step')}
                disabled={invoices.length === 0}
              >
                👣 Start in Step Mode
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => setShowManualForm(true)}
              >
                + Add Invoice Manually
              </button>
            </>
          ) : (
            <>
              <button className="btn-stop" onClick={handleStopProcessing}>
                🛑 Stop
              </button>
              
              {processingMode === 'step' || isStepWaiting ? (
                <button className="btn-primary" onClick={handleAdvanceStep}>
                  ⏩ Step Next
                </button>
              ) : null}

              <button className="btn-secondary" onClick={handleToggleMode}>
                {processingMode === 'auto' ? '⏸️ Pause after this' : '▶️ Resume Auto'}
              </button>
            </>
          )}
        </div>

        <InvoiceQueue invoices={invoices} />
        <DownloadButtons pdfUrl={downloadUrls.pdfUrl} xlsxUrl={downloadUrls.xlsxUrl} />
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

