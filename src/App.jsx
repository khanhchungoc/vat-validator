import { useState } from 'react'

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>VATOCR</h1>
        <span className="ws-status">Connecting...</span>
      </header>
      <main className="app-main">
        <p>Drop XML files here...</p>
      </main>
    </div>
  )
}
