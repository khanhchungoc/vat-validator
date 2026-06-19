const { handleMessage } = require('../wsHandler')
const store = require('../invoiceStore')

beforeEach(() => {
  store.clearInvoices()
})

test('handleMessage ping', async () => {
  const ws = {
    send: jest.fn()
  }
  await handleMessage(ws, { type: 'ping' })
  expect(ws.send).toHaveBeenCalledTimes(1)
  expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({ type: 'pong' })
})

test('handleMessage add-manual-invoice success', async () => {
  const ws = {
    send: jest.fn(),
    readyState: 1
  }
  const wss = {
    clients: [ws]
  }
  const payload = {
    invoiceCode: 'A12BCD',
    invoiceNumber: '987654',
    sellerName: 'Manual Seller Co',
    taxId: '1234567890',
    sellerAddress: '123 Main St',
    totalAmount: 150.5
  }
  await handleMessage(ws, { type: 'add-manual-invoice', payload }, wss)

  expect(ws.send).toHaveBeenCalledTimes(1)
  const response = JSON.parse(ws.send.mock.calls[0][0])
  expect(response.type).toBe('invoice-added')
  expect(response.payload).toEqual({
    id: 'A12BCD-987654',
    source: 'manual',
    invoiceCode: 'A12BCD',
    invoiceNumber: '987654',
    sellerName: 'Manual Seller Co',
    taxId: '1234567890',
    sellerAddress: '123 Main St',
    totalAmount: 150.5,
    status: 'pending'
  })

  expect(store.getInvoices()).toHaveLength(1)
  expect(store.getInvoices()[0]).toEqual(response.payload)
})

test('handleMessage add-manual-invoice missing fields', async () => {
  const ws = {
    send: jest.fn()
  }
  const payload = {
    // missing invoiceCode, sellerName
    invoiceNumber: 123,
    taxId: '1234567890',
    totalAmount: 150.5
  }
  await handleMessage(ws, { type: 'add-manual-invoice', payload })

  expect(ws.send).toHaveBeenCalledTimes(1)
  const response = JSON.parse(ws.send.mock.calls[0][0])
  expect(response.type).toBe('error')
  expect(response.payload).toContain('Missing fields')
  expect(response.payload).toContain('invoiceCode')
  expect(response.payload).toContain('sellerName')

  expect(store.getInvoices()).toHaveLength(0)
})

test('handleMessage add-manual-invoice duplicate error', async () => {
  const ws = {
    send: jest.fn(),
    readyState: 1
  }
  const wss = {
    clients: [ws]
  }
  const payload = {
    invoiceCode: 'DUP123',
    invoiceNumber: '000123',
    sellerName: 'Duplicate Inc',
    taxId: '0987654321',
    sellerAddress: '',
    totalAmount: 500
  }

  // Add once successfully
  await handleMessage(ws, { type: 'add-manual-invoice', payload }, wss)
  expect(store.getInvoices()).toHaveLength(1)

  // Try to add again
  const ws2 = {
    send: jest.fn()
  }
  await handleMessage(ws2, { type: 'add-manual-invoice', payload })
  
  expect(ws2.send).toHaveBeenCalledTimes(1)
  const response = JSON.parse(ws2.send.mock.calls[0][0])
  expect(response.type).toBe('error')
  expect(response.payload).toContain('Duplicate invoice ID')
  
  expect(store.getInvoices()).toHaveLength(1)
})

test('handleMessage add-manual-invoice missing payload entirely', async () => {
  const ws = {
    send: jest.fn()
  }
  // No payload is sent at all
  await handleMessage(ws, { type: 'add-manual-invoice' })

  expect(ws.send).toHaveBeenCalledTimes(1)
  const response = JSON.parse(ws.send.mock.calls[0][0])
  expect(response.type).toBe('error')
  expect(response.payload).toContain('Missing fields')
  expect(store.getInvoices()).toHaveLength(0)
})

test('handleMessage add-manual-invoice non-numeric totalAmount', async () => {
  const ws = {
    send: jest.fn()
  }
  const payload = {
    invoiceCode: 'NONNUM',
    invoiceNumber: '000124',
    sellerName: 'Non Numeric Inc',
    taxId: '0987654321',
    sellerAddress: '',
    totalAmount: 'abc'
  }
  await handleMessage(ws, { type: 'add-manual-invoice', payload })

  expect(ws.send).toHaveBeenCalledTimes(1)
  const response = JSON.parse(ws.send.mock.calls[0][0])
  expect(response.type).toBe('error')
  expect(response.payload).toBe('Invalid total amount')
  expect(store.getInvoices()).toHaveLength(0)
})

test('handleMessage add-manual-invoice zero or negative totalAmount', async () => {
  const ws = {
    send: jest.fn()
  }
  const payloadZero = {
    invoiceCode: 'ZEROVAL',
    invoiceNumber: '000125',
    sellerName: 'Zero Inc',
    taxId: '0987654321',
    sellerAddress: '',
    totalAmount: 0
  }
  await handleMessage(ws, { type: 'add-manual-invoice', payload: payloadZero })

  expect(ws.send).toHaveBeenCalledTimes(1)
  let response = JSON.parse(ws.send.mock.calls[0][0])
  expect(response.type).toBe('error')
  expect(response.payload).toBe('Invalid total amount')

  const wsNegative = {
    send: jest.fn()
  }
  const payloadNegative = {
    invoiceCode: 'NEGVAL',
    invoiceNumber: '000126',
    sellerName: 'Neg Inc',
    taxId: '0987654321',
    sellerAddress: '',
    totalAmount: -100
  }
  await handleMessage(wsNegative, { type: 'add-manual-invoice', payload: payloadNegative })

  expect(wsNegative.send).toHaveBeenCalledTimes(1)
  response = JSON.parse(wsNegative.send.mock.calls[0][0])
  expect(response.type).toBe('error')
  expect(response.payload).toBe('Invalid total amount')

  expect(store.getInvoices()).toHaveLength(0)
})
