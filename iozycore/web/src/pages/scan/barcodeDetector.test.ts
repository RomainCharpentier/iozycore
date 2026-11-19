import { afterEach, describe, expect, it, vi } from 'vitest'

const ponyfill = vi.hoisted(() => ({
  setZXingModuleOverrides: vi.fn(),
  BarcodeDetector: vi.fn(function (this: { formats: unknown }, options: { formats: unknown }) {
    this.formats = options.formats
  }),
}))
vi.mock('barcode-detector/ponyfill', () => ponyfill)
vi.mock('zxing-wasm/reader/zxing_reader.wasm?url', () => ({ default: '/assets/zxing_reader-abc.wasm' }))

import { createBarcodeDetector } from './barcodeDetector'

afterEach(() => {
  delete window.BarcodeDetector
  vi.clearAllMocks()
})

describe('the barcode reader', () => {
  it('uses the browser reader when there is one', async () => {
    window.BarcodeDetector = vi.fn(function () {
      return { detect: vi.fn() }
    }) as unknown as typeof window.BarcodeDetector
    const choice = await createBarcodeDetector(['ean_13'])
    expect(choice.builtIn).toBe(false)
    expect(ponyfill.BarcodeDetector).not.toHaveBeenCalled()
  })

  it('brings its own on Safari, with the wasm served by the app, not a CDN', async () => {
    const choice = await createBarcodeDetector(['ean_13'])
    expect(choice.builtIn).toBe(true)
    const { locateFile } = ponyfill.setZXingModuleOverrides.mock.calls[0][0]
    expect(locateFile('zxing_reader.wasm', 'https://fastly.jsdelivr.net/')).toBe('/assets/zxing_reader-abc.wasm')
  })
})
