import { useEffect, useState } from 'react'

export default function ResumePanel({ onResume }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const port = new URLSearchParams(window.location.search).get('port') || '3001'
    fetch(`http://localhost:${port}/sessions`)
      .then(r => r.json())
      .then(data => { setSessions(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

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
          <button className="btn-primary" onClick={() => onResume(session.sessionDir)}>
            Resume →
          </button>
        </div>
      ))}
    </div>
  )
}
