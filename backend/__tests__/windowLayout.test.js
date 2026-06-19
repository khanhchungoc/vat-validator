const {
  buildSplitWindowLayout,
  parseBrowserBounds,
  formatChromiumWindowArgs
} = require('../windowLayout')

describe('window layout helpers', () => {
  test('splits the display work area into left app and right browser bounds', () => {
    const layout = buildSplitWindowLayout({ x: 10, y: 20, width: 1920, height: 1040 })

    expect(layout).toEqual({
      appBounds: { x: 10, y: 20, width: 960, height: 1040 },
      browserBounds: { x: 970, y: 20, width: 960, height: 1040 }
    })
  })

  test('keeps odd-width displays within the work area', () => {
    const layout = buildSplitWindowLayout({ x: 0, y: 0, width: 1367, height: 768 })

    expect(layout.appBounds.width).toBe(683)
    expect(layout.browserBounds).toEqual({ x: 683, y: 0, width: 684, height: 768 })
  })

  test('parses browser bounds from JSON only when all numeric fields are present', () => {
    expect(parseBrowserBounds('{"x":960,"y":0,"width":960,"height":1040}')).toEqual({
      x: 960,
      y: 0,
      width: 960,
      height: 1040
    })
    expect(parseBrowserBounds('{"x":960,"width":960,"height":1040}')).toBeNull()
    expect(parseBrowserBounds('not-json')).toBeNull()
  })

  test('formats Chromium window arguments from bounds', () => {
    expect(formatChromiumWindowArgs({ x: 960, y: 0, width: 960, height: 1040 })).toEqual([
      '--window-position=960,0',
      '--window-size=960,1040'
    ])
  })
})
