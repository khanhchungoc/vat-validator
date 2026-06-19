import { useRef, useState } from 'react'

export default function DropZone({ onFilesUploaded, onError, disabled }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()

  async function uploadFiles(files) {
    if (disabled) return
    const xmlFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.xml'))
    if (xmlFiles.length === 0) return

    setUploading(true)
    const formData = new FormData()
    xmlFiles.forEach(f => formData.append('files', f))

    try {
      const port = new URLSearchParams(window.location.search).get('port') || '3001'
      const res = await fetch(`http://localhost:${port}/upload`, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || `Server responded with status ${res.status}`)
      }
      if (!data?.results) {
        throw new Error('Invalid server response structure')
      }
      onFilesUploaded(data.results)
    } catch (e) {
      console.error('Upload failed:', e)
      if (onError) {
        onError(`Không thể tải lên hóa đơn: ${e.message}`)
      } else {
        alert(`Không thể tải lên hóa đơn: ${e.message}`)
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
      onDragOver={e => { 
        e.preventDefault()
        if (!disabled) setDragging(true) 
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { 
        e.preventDefault()
        setDragging(false)
        if (!disabled) uploadFiles(e.dataTransfer.files) 
      }}
      onClick={() => !disabled && inputRef.current.click()}
    >
      <input 
        ref={inputRef} 
        type="file" 
        accept=".xml" 
        multiple 
        hidden
        onClick={e => e.stopPropagation()}
        onChange={e => {
          if (!disabled) {
            uploadFiles(e.target.files)
            e.target.value = ''
          }
        }} 
      />
      {uploading
        ? <p>Đang tải lên...</p>
        : disabled 
          ? <p>🔒 Đang trong quá trình xử lý...</p>
          : <p>📂 Kéo thả các tệp XML vào đây hoặc click để duyệt tệp</p>}
    </div>
  )
}
