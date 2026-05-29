import { useState } from 'react'

const EMPTY = { invoiceCode: '', invoiceNumber: '', sellerName: '', taxId: '', sellerAddress: '', totalAmount: '' }

export default function ManualEntryForm({ onSubmit, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const required = ['invoiceCode', 'invoiceNumber', 'sellerName', 'taxId', 'totalAmount']
    
    // Clean string-based validation
    const missing = required.filter(k => !String(form[k]).trim())
    if (missing.length > 0) { 
      setError(`Required fields missing: ${missing.join(', ')}`)
      return 
    }

    const numericAmount = Number(form.totalAmount)
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Total Amount must be a valid positive number.')
      return
    }

    onSubmit({ 
      ...form, 
      invoiceNumber: String(form.invoiceNumber),
      totalAmount: numericAmount 
    })
    setForm(EMPTY)
    setError('')
  }

  const fields = [
    { name: 'invoiceCode', label: 'Invoice Code (Ký hiệu)', required: true },
    { name: 'invoiceNumber', label: 'Invoice Number (Số HĐ)', required: true },
    { name: 'sellerName', label: 'Seller Name', required: true },
    { name: 'taxId', label: 'Tax ID (MST)', required: true },
    { name: 'sellerAddress', label: 'Seller Address', required: false },
    { name: 'totalAmount', label: 'Total Amount (VND)', required: true, type: 'number' }
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Add Invoice Manually</h3>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          {fields.map(f => (
            <div className="field" key={f.name}>
              <label>{f.label}{f.required && ' *'}</label>
              <input name={f.name} type={f.type || 'text'} value={form[f.name]}
                onChange={handleChange} className="mock-input" />
            </div>
          ))}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Add Invoice</button>
          </div>
        </form>
      </div>
    </div>
  )
}
