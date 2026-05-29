import { useEffect, useRef } from 'react'

export function useWebSocket(onMessage) {
  const ws = useRef(null)

  useEffect(() => {
    ws.current = new WebSocket('ws://localhost:3001')

    ws.current.onopen = () => {
      console.log('[WS] Connected to backend')
      ws.current.send(JSON.stringify({ type: 'ping' }))
    }

    ws.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (onMessage) onMessage(msg)
      } catch (e) {
        console.error('[WS] Failed to parse message', e)
      }
    }

    ws.current.onclose = () => {
      console.log('[WS] Disconnected')
      // Simple reconnect logic could go here
    }

    return () => {
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [onMessage])

  const send = (msg) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg))
    }
  }

  return { send }
}
