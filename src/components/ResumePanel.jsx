import { useEffect, useState } from 'react'

export default function ResumePanel({ onResume, onDeleteSession }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchSessions = () => {
    const port = new URLSearchParams(window.location.search).get('port') || '3001'
    fetch(`http://localhost:${port}/sessions`)
      .then(r => r.json())
      .then(data => { setSessions(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  const handleDelete = async (session) => {
    const confirmed = window.confirm(`Are you sure you want to permanently delete the session "${session.id.replace(/_/g, ' ')}"? This action cannot be undone.`)
    if (!confirmed) return

    try {
      const port = new URLSearchParams(window.location.search).get('port') || '3001'
      const res = await fetch(`http://localhost:${port}/sessions/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionDir: session.sessionDir })
      })
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== session.id))
        if (onDeleteSession) onDeleteSession(session.sessionDir)
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete session')
      }
    } catch (err) {
      alert('Failed to delete session')
    }
  }

  if (loading || sessions.length === 0) return null

  return (
    <div className="resume-panel">
      <h3>📁 Resume Previous Sessions</h3>
      {sessions.map(session => (
        <div key={session.id} className="resume-card">
          <div className="resume-info">
            <span className="resume-id">{session.id.replace(/_/g, ' ')}</span>
            <span className="resume-progress">
              {session.progress.done}/{session.progress.total} invoices completed
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              className="btn-secondary" 
              style={{ borderColor: 'var(--fail)', color: 'var(--fail)' }} 
              onClick={() => handleDelete(session)}
            >
              Delete
            </button>
            <button className="btn-primary" onClick={() => onResume(session.sessionDir)}>
              Resume →
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

