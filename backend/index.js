const express = require('express')
const { WebSocketServer } = require('ws')
const http = require('http')
const { handleMessage } = require('./wsHandler')

const app = express()
app.use(express.json())

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  next()
})

const uploadRoute = require('./routes/upload')
app.use('/upload', uploadRoute)

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

const server = http.createServer(app)
const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  console.log('[WS] Client connected')
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      handleMessage(ws, msg, wss)
    } catch (e) {
      console.error('[WS] Invalid JSON received:', e.message)
    }
  })
  ws.on('close', () => console.log('[WS] Client disconnected'))
})

const PORT = 3001
server.listen(PORT, () => {
  console.log(`[Backend] HTTP and WS listening on port ${PORT}`)
})
