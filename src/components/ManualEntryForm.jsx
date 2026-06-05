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
      const fieldLabels = {
        invoiceCode: 'Ký hiệu hóa đơn',
        invoiceNumber: 'Số hóa đơn',
        sellerName: 'Tên người bán',
        taxId: 'Mã số thuế',
        totalAmount: 'Tổng tiền'
      }
      const missingLabels = missing.map(k => fieldLabels[k] || k)
      setError(`Thiếu các thông tin bắt buộc: ${missingLabels.join(', ')}`)
      return 
    }

    const numericAmount = Number(form.totalAmount)
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Tổng tiền phải là số dương hợp lệ.')
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
    { name: 'invoiceCode', label: 'Ký hiệu hóa đơn', required: true },
    { name: 'invoiceNumber', label: 'Số hóa đơn', required: true },
    { name: 'sellerName', label: 'Tên người bán', required: true },
    { name: 'taxId', label: 'Mã số thuế (MST)', required: true },
    { name: 'sellerAddress', label: 'Địa chỉ người bán', required: false },
    { name: 'totalAmount', label: 'Tổng tiền (VND)', required: true, type: 'number' }
  ]

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Thêm hóa đơn thủ công</h3>
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
            <button type="button" className="btn-secondary" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn-primary">Thêm hóa đơn</button>
          </div>
        </form>
      </div>
    </div>
  )
}
