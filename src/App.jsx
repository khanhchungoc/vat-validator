import { useState, useCallback } from 'react'
import { useWebSocket } from './useWebSocket'

export default function App() {
  const [wsStatus, setWsStatus] = useState('Connecting...')

  const handleWsMessage = useCallback((msg) => {
    if (msg.type === 'pong') {
      setWsStatus('Connected ✅')
    }
  }, [])

  const { send } = useWebSocket(handleWsMessage)

  return (
    <div className="app">
      <header className="app-header">
        <h1>VATOCR</h1>
        <span className="ws-status">{wsStatus}</span>
      </header>
      <main className="app-main">
        <p>Drop XML files here...</p>
        <button 
          className="btn-primary" 
          onClick={() => send({ type: 'ping' })}
          style={{ marginTop: 20 }}
        >
          Ping Backend
        </button>
      </main>
    </div>
  )
}
