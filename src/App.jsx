import { useState, useCallback } from 'react'
import { useWebSocket } from './useWebSocket'
import DropZone from './components/DropZone'
import ManualEntryForm from './components/ManualEntryForm'
import InvoiceQueue from './components/InvoiceQueue'
import CaptchaModal from './components/CaptchaModal'
import ResumePanel from './components/ResumePanel'
import DownloadButtons from './components/DownloadButtons'
import DuplicateWarning from './components/DuplicateWarning'
import ErrorBanner from './components/ErrorBanner'
import ModeToggle from './components/ModeToggle'
import ProgressBar from './components/ProgressBar'
import StepButton from './components/StepButton'



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
  const [duplicates, setDuplicates] = useState([])
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)
  const [processingError, setProcessingError] = useState(null)

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
      setProcessingError(null)
    }
    if (msg.type === 'processing-error') {
      setProcessingError(msg.payload.message)
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
      if (msg.payload?.pdfUrl || msg.payload?.xlsxUrl) {
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
    const dupes = results.filter(r => !r.ok && r.error?.includes('Duplicate')).map(r => {
      const match = r.error.match(/Duplicate invoice ID:\s*(.+)/i)
      return match ? match[1] : r.error
    })
    const otherErrors = results.filter(r => !r.ok && !r.error?.includes('Duplicate')).map(r => r.error)
    
    setInvoices(prev => {
      const filteredAdded = added.filter(newInv => !prev.some(oldInv => oldInv.id === newInv.id))
      return [...prev, ...filteredAdded]
    })
    
    if (dupes.length > 0) {
      setDuplicates(dupes)
      setShowDuplicateWarning(true)
    }
    if (otherErrors.length > 0) {
      alert(otherErrors.join('\n'))
    }
  }, [])

  const handleRemoveDuplicates = useCallback(() => {
    setShowDuplicateWarning(false)
    setDuplicates([])
  }, [])

  const handleProceedWithDuplicates = useCallback(() => {
    setShowDuplicateWarning(false)
    setDuplicates([])
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

  const handleRetry = useCallback(() => {
    send({ type: 'captcha-answer', payload: { answer: 'retry' } })
    setProcessingError(null)
  }, [send])

  const handleErrorSkip = useCallback(() => {
    send({ type: 'skip-invoice' })
    setProcessingError(null)
  }, [send])

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

  const handleModeChange = useCallback((newMode) => {
    setProcessingMode(newMode)
    if (isProcessing) {
      send({ type: 'set-mode', payload: { mode: newMode === 'step' ? 'paused' : 'auto' } })
    }
  }, [isProcessing, send])

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
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginTop: 12 }}>
          {!isProcessing ? (
            <>
              <button 
                className="btn-primary" 
                onClick={() => handleStartProcessing(processingMode)}
                disabled={invoices.length === 0}
              >
                🚀 Start Processing
              </button>
              <ModeToggle 
                mode={processingMode} 
                onChange={handleModeChange} 
                disabled={invoices.length === 0} 
              />
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
              <ModeToggle 
                mode={processingMode} 
                onChange={handleModeChange} 
                disabled={false} 
              />
            </>
          )}
        </div>

        <StepButton visible={isProcessing && isStepWaiting} onStep={handleAdvanceStep} />
        <ProgressBar invoices={invoices} />

        <ErrorBanner error={processingError} onRetry={handleRetry} onSkip={handleErrorSkip} />
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
      {showDuplicateWarning && (
        <DuplicateWarning
          duplicates={duplicates}
          onRemove={handleRemoveDuplicates}
          onProceed={handleProceedWithDuplicates}
        />
      )}
    </div>
  )
}

