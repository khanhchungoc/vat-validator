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
    const confirmed = window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn phiên làm việc này không? Thao tác này không thể hoàn tác.')
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
        alert(data.error || 'Không thể xóa phiên làm việc')
      }
    } catch (err) {
      alert('Không thể xóa phiên làm việc')
    }
  }

  if (loading || sessions.length === 0) return null

  return (
    <div className="resume-panel">
      <h3>📁 Khôi phục phiên làm việc trước</h3>
      {sessions.map(session => (
        <div key={session.id} className="resume-card">
          <div className="resume-info">
            <span className="resume-id">{session.id.replace(/_/g, ' ')}</span>
            <span className="resume-progress">
              Đã hoàn thành {session.progress.done}/{session.progress.total} hóa đơn
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              className="btn-secondary" 
              style={{ borderColor: 'var(--fail)', color: 'var(--fail)' }} 
              onClick={() => handleDelete(session)}
            >
              Xóa
            </button>
            <button className="btn-primary" onClick={() => onResume(session.sessionDir)}>
              Tiếp tục →
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

