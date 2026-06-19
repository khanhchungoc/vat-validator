const BROWSER_BOUNDS_ENV = 'VATOCR_BROWSER_BOUNDS'
const DEFAULT_VIEWPORT = { width: 1280, height: 900 }
const BROWSER_CHROME_HEIGHT = 120

function normalizeBounds(bounds) {
  if (!bounds || typeof bounds !== 'object') return null

  const x = Number(bounds.x)
  const y = Number(bounds.y)
  const width = Number(bounds.width)
  const height = Number(bounds.height)

  if (![x, y, width, height].every(Number.isFinite)) return null
  if (width <= 0 || height <= 0) return null

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height)
  }
}

function buildSplitWindowLayout(workArea) {
  const bounds = normalizeBounds(workArea)
  if (!bounds) {
    throw new Error('A valid display work area is required to build the split-window layout')
  }

  const appWidth = Math.floor(bounds.width / 2)
  const browserWidth = bounds.width - appWidth

  return {
    appBounds: {
      x: bounds.x,
      y: bounds.y,
      width: appWidth,
      height: bounds.height
    },
    browserBounds: {
      x: bounds.x + appWidth,
      y: bounds.y,
      width: browserWidth,
      height: bounds.height
    }
  }
}

function parseBrowserBounds(rawValue) {
  if (!rawValue) return null

  try {
    return normalizeBounds(JSON.parse(rawValue))
  } catch (_err) {
    return null
  }
}

function getBrowserBoundsFromEnv(env = process.env) {
  return parseBrowserBounds(env[BROWSER_BOUNDS_ENV])
}

function resolveBrowserBounds(explicitBounds = null, env = process.env) {
  return normalizeBounds(explicitBounds) || getBrowserBoundsFromEnv(env)
}

function formatChromiumWindowArgs(bounds) {
  const normalized = normalizeBounds(bounds)
  if (!normalized) return []

  return [
    `--window-position=${normalized.x},${normalized.y}`,
    `--window-size=${normalized.width},${normalized.height}`
  ]
}

function buildBrowserLaunchOptions(explicitBounds = null, env = process.env) {
  const browserBounds = resolveBrowserBounds(explicitBounds, env)

  return {
    headless: false,
    args: formatChromiumWindowArgs(browserBounds)
  }
}

function getViewportForBrowserBounds(bounds) {
  const normalized = normalizeBounds(bounds)
  if (!normalized) return DEFAULT_VIEWPORT

  return {
    width: Math.max(800, normalized.width),
    height: Math.max(600, normalized.height - BROWSER_CHROME_HEIGHT)
  }
}

module.exports = {
  BROWSER_BOUNDS_ENV,
  buildSplitWindowLayout,
  parseBrowserBounds,
  getBrowserBoundsFromEnv,
  resolveBrowserBounds,
  formatChromiumWindowArgs,
  buildBrowserLaunchOptions,
  getViewportForBrowserBounds
}
