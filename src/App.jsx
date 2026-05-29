import { useState, useCallback } from 'react'
import { useWebSocket } from './useWebSocket'
import DropZone from './components/DropZone'
import ManualEntryForm from './components/ManualEntryForm'
import InvoiceQueue from './components/InvoiceQueue'

export default function App() {
  const [invoices, setInvoices] = useState([])
  const [showManualForm, setShowManualForm] = useState(false)
  const [wsStatus, setWsStatus] = useState('Connecting...')

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
    send({ type: 'add-manual-invoice', payload: data })
    setShowManualForm(false)
  }, [send])

  return (
    <div className="app">
      <header className="app-header">
        <h1>VATOCR</h1>
        <span className="ws-status">{wsStatus}</span>
      </header>
      <main className="app-main">
        <DropZone onFilesUploaded={handleFilesUploaded} />
        <button 
          className="btn-secondary" 
          style={{ alignSelf: 'flex-start', marginTop: 8 }}
          onClick={() => setShowManualForm(true)}
        >
          + Add Invoice Manually
        </button>
        <InvoiceQueue invoices={invoices} />
      </main>
      {showManualForm && (
        <ManualEntryForm
          onSubmit={handleManualSubmit}
          onClose={() => setShowManualForm(false)}
        />
      )}
    </div>
  )
}

