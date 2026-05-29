function handleMessage(ws, msg, wss) {
  console.log('[WS] Received:', msg.type)
  switch (msg.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }))
      break
    default:
      console.warn('[WS] Unknown message type:', msg.type)
  }
}

function broadcast(wss, msg) {
  const data = JSON.stringify(msg)
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(data)
  })
}

module.exports = { handleMessage, broadcast }
