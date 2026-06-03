import { useState, useCallback } from 'react'
import { useWebSocket } from './useWebSocket'

// Read backend port injected by Electron (file:///dist/index.html?port=XXXXX)
// Falls back to 3001 in dev (Vite)
function getApiBase() {
  const port = new URLSearchParams(window.location.search).get('port') || '3001'
  return `http://localhost:${port}`
}
import DropZone from './components/DropZone'
import ManualEntryForm from './components/ManualEntryForm'
import InvoiceQueue from './components/InvoiceQueue'
import CaptchaModal from './components/CaptchaModal' // Native CAPTCHA Solve Modal
import ResumePanel from './components/ResumePanel'
import DownloadButtons from './components/DownloadButtons'
import DuplicateWarning from './components/DuplicateWarning'
import ErrorBanner from './components/ErrorBanner'
import ModeToggle from './components/ModeToggle'
import ProgressBar from './components/ProgressBar'
import StepButton from './components/StepButton'
import LiveConsole from './components/LiveConsole'



export default function App() {
  const [invoices, setInvoices] = useState([])
  const [showManualForm, setShowManualForm] = useState(false)
  const [appError, setAppError] = useState(null)
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
  const [logs, setLogs] = useState([])
  const [showConsole, setShowConsole] = useState(false)

  const handleWsMessage = useCallback((msg) => {
    if (msg.type === 'ws-status') {
      setWsStatus(msg.payload)
      if (msg.payload.includes('Disconnected') || msg.payload.includes('Error')) {
        setIsProcessing(false)
        setIsStepWaiting(false)
        setCaptchaData(null)
      }
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
      setCaptchaData(null)
    }
    if (msg.type === 'captcha-success') {
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
      setAppError(msg.payload)
    }
    if (msg.type === 'invoices-reset') {
      setInvoices(msg.payload)
    }
    if (msg.type === 'processing-log-clear') {
      setLogs([])
    }
    if (msg.type === 'processing-log') {
      setLogs(prev => [...prev, msg.payload])
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
      setAppError(otherErrors.join('\n'))
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
      setAppError('Failed to send manual invoice: WebSocket is disconnected.')
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
      const res = await fetch(`${getApiBase()}/sessions/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionDir })
      })
      const data = await res.json()
      if (res.ok) {
        setInvoices(data.invoices)
        setCurrentSessionDir(sessionDir)
      } else {
        setAppError(data.error || 'Failed to resume session')
      }
    } catch (e) {
      setAppError('Failed to resume session')
    }
  }, [])

  const handleClearSession = useCallback(() => {
    send({ type: 'clear-session' })
    setCurrentSessionDir(null)
    setDownloadUrls({ pdfUrl: null, xlsxUrl: null })
    setLogs([])
    setCaptchaData(null)
    setProcessingError(null)
    setAppError(null)
    setIsStepWaiting(false)
    setIsProcessing(false)
  }, [send])

  const handleStartProcessing = useCallback(async (mode = 'auto') => {
    setDownloadUrls({ pdfUrl: null, xlsxUrl: null })
    setLogs([])
    setShowConsole(true)
    let sessionDir = currentSessionDir
    if (!sessionDir) {
      try {
        const res = await fetch(`${getApiBase()}/sessions/new`, { method: 'POST' })
        const data = await res.json()
        if (res.ok) {
          sessionDir = data.sessionDir
          setCurrentSessionDir(sessionDir)
        } else {
          setAppError('Failed to create session: ' + (data.error || 'Unknown error'))
          return
        }
      } catch (e) {
        setAppError('Failed to create session')
        return
      }
    }
    setProcessingMode(mode)
    setIsProcessing(true)
    const sent = send({ type: 'start-processing', payload: { sessionDir, mode } })
    if (!sent) {
      setAppError('Failed to start processing: WebSocket is disconnected.')
      setIsProcessing(false)
    }
  }, [currentSessionDir, send])

  const handleStopProcessing = useCallback(() => {
    const sent = send({ type: 'stop-processing' })
    if (!sent) {
      setAppError('Failed to stop processing: WebSocket is disconnected.')
    } else {
      setIsProcessing(false)
      setIsStepWaiting(false)
    }
  }, [send])

  const handleAdvanceStep = useCallback(() => {
    const sent = send({ type: 'advance-step' })
    if (!sent) {
      setAppError('Failed to advance step: WebSocket is disconnected.')
    } else {
      setIsStepWaiting(false)
    }
  }, [send])

  const handleModeChange = useCallback((newMode) => {
    setProcessingMode(newMode)
    if (isProcessing) {
      const sent = send({ type: 'set-mode', payload: { mode: newMode === 'step' ? 'paused' : 'auto' } })
      if (!sent) {
        setAppError('Failed to update mode: WebSocket is disconnected.')
      }
    }
  }, [isProcessing, send])

  return (
    <div className="app">
      <header className="app-header">
        <h1>VAT-validator</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            className={`btn-console-toggle ${showConsole ? 'active' : ''}`}
            onClick={() => setShowConsole(!showConsole)}
            title="Toggle Live Activity Console"
          >
            {showConsole ? '✕ Close Log' : '📋 Activity Log'}
          </button>
          <span className="ws-status">{wsStatus}</span>
        </div>
      </header>
      <main className="app-main">
        <div className={`app-layout ${showConsole ? 'with-sidebar' : 'no-sidebar'}`}>
          <div className="layout-left">
            <div className="layout-left-content">
              {appError && (
                <div style={{
                  background: '#fef2f2', border: '1px solid var(--fail)',
                  borderRadius: 8, padding: '14px 18px', marginBottom: 16,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12
                }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: 'var(--fail)', display: 'block', marginBottom: 6 }}>⚠️ Processing Error</strong>
                    <pre style={{ margin: 0, fontSize: '0.78rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-main)', userSelect: 'text' }}>{appError}</pre>
                  </div>
                  <button onClick={() => setAppError(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', flexShrink: 0 }}>✕</button>
                </div>
              )}

              {!currentSessionDir && invoices.length === 0 && (
                <ResumePanel onResume={handleResume} />
              )}
              
              <DropZone onFilesUploaded={handleFilesUploaded} onError={setAppError} disabled={isProcessing} />
              
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
                    {invoices.some(i => i.status === 'skipped') && (
                      <button 
                        className="btn-secondary" 
                        onClick={() => send({ type: 'reset-skipped', payload: { sessionDir: currentSessionDir } })}
                      >
                        🔄 Reset Skipped to Pending
                      </button>
                    )}
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
                    {(invoices.length > 0 || currentSessionDir) && (
                      <button 
                        className="btn-danger-outline" 
                        onClick={handleClearSession}
                        title="Clear all invoices and start a new session"
                      >
                        🧹 Clear & New Session
                      </button>
                    )}
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
            </div>

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

          <div className="layout-right">
            <LiveConsole 
              logs={logs} 
              isProcessing={isProcessing} 
              onClose={() => setShowConsole(false)} 
            />
          </div>
        </div>
      </main>
    </div>
  )
}

