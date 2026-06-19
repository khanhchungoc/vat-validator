const fs = require('fs')
const path = require('path')

describe('font theme', () => {
  test('uses Aptos as the primary app UI font', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../src/index.css'), 'utf8')

    expect(css).toContain("font-family: 'Aptos', 'Segoe UI', Arial, sans-serif;")
  })

  test('uses Aptos as the primary Electron error window font', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../electron/error.html'), 'utf8')

    expect(html).toContain("font-family: 'Aptos', 'Segoe UI', Arial, sans-serif;")
  })
})
