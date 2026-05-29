import { useRef, useState } from 'react'

export default function DropZone({ onFilesUploaded }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()

  async function uploadFiles(files) {
    const xmlFiles = Array.from(files).filter(f => f.name.endsWith('.xml'))
    if (xmlFiles.length === 0) return

    setUploading(true)
    const formData = new FormData()
    xmlFiles.forEach(f => formData.append('files', f))

    try {
      const res = await fetch('http://localhost:3001/upload', { method: 'POST', body: formData })
      const data = await res.json()
      onFilesUploaded(data.results)
    } catch (e) {
      console.error('Upload failed:', e)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files) }}
      onClick={() => inputRef.current.click()}
    >
      <input ref={inputRef} type="file" accept=".xml" multiple hidden
        onChange={e => uploadFiles(e.target.files)} />
      {uploading
        ? <p>Uploading...</p>
        : <p>📂 Drop XML files here or click to browse</p>}
    </div>
  )
}
