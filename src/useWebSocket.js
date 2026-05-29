import { useEffect, useRef } from 'react'

export function useWebSocket(onMessage) {
  const ws = useRef(null)
  const onMessageRef = useRef(onMessage)
  const reconnectTimer = useRef(null)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    function connect() {
      if (ws.current) {
        ws.current.onopen = null
        ws.current.onerror = null
        ws.current.onmessage = null
        ws.current.onclose = null
        ws.current.close()
      }

      console.log('[WS] Connecting to backend...')
      if (onMessageRef.current) {
        onMessageRef.current({ type: 'ws-status', payload: 'Connecting...' })
      }

      const socket = new WebSocket('ws://localhost:3001')
      ws.current = socket

      socket.onopen = () => {
        console.log('[WS] Connected to backend')
        if (onMessageRef.current) {
          onMessageRef.current({ type: 'ws-status', payload: 'Connected ✅' })
        }
        socket.send(JSON.stringify({ type: 'ping' }))
      }

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (onMessageRef.current) onMessageRef.current(msg)
        } catch (e) {
          console.error('[WS] Failed to parse message', e)
        }
      }

      socket.onerror = (err) => {
        console.error('[WS] Socket error:', err)
        if (onMessageRef.current) {
          onMessageRef.current({ type: 'ws-status', payload: 'Connection Error ❌' })
        }
      }

      socket.onclose = () => {
        console.log('[WS] Disconnected, scheduling reconnect...')
        if (onMessageRef.current) {
          onMessageRef.current({ type: 'ws-status', payload: 'Disconnected ❌' })
        }
        reconnectTimer.current = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
      }
      if (ws.current) {
        ws.current.onopen = null
        ws.current.onerror = null
        ws.current.onmessage = null
        ws.current.onclose = null
        ws.current.close()
      }
    }
  }, [])

  const send = (msg) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg))
    }
  }

  return { send }
}

