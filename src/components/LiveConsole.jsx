import { useEffect, useRef, useState } from 'react'

export default function LiveConsole({ logs = [], isProcessing, onClose }) {
  const [isOpen, setIsOpen] = useState(true)
  const logsEndRef = useRef(null)

  useEffect(() => {
    if (logsEndRef.current && isOpen) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, isOpen])

  // Auto expand when processing begins
  useEffect(() => {
    if (isProcessing) {
      setIsOpen(true)
    }
  }, [isProcessing])

  return (
    <div className={`live-console ${isOpen ? 'expanded' : 'collapsed'}`}>
      <div className="console-accordion-header">
        <button 
          className="console-header-btn"
          onClick={() => setIsOpen(!isOpen)}
          title={isOpen ? "Thu nhỏ nhật ký" : "Mở rộng nhật ký"}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className={`console-status-indicator ${isProcessing ? 'active' : 'idle'}`}></div>
            <span className="console-title-text">&gt;_ Nhật ký hoạt động thời gian thực</span>
          </div>
          <span className={`console-chevron ${isOpen ? 'open' : ''}`}>▼</span>
        </button>
        <button className="console-close-btn" onClick={onClose} title="Ẩn cột nhật ký">✕</button>
      </div>

      {isOpen && (
        <div className="console-body">
          {logs.length === 0 ? (
            <div className="console-placeholder">
              <span>Đang chờ tiến trình tự động bắt đầu. Các bước thực hiện sẽ hiển thị ở đây...</span>
            </div>
          ) : (
            <div className="console-lines">
              {logs.map((log, index) => (
                <div key={`${log.timestamp}-${index}`} className="console-line">
                  <span className="console-time">[{log.timestamp}]</span>
                  <span className="console-text">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
