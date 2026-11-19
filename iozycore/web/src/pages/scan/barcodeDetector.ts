/**
 * The barcode reader of the scan page.
 *
 * The browser's own detector (Shape Detection API) exists in Chrome, Edge and
 * Android, not in Safari or Firefox: on an iPhone the camera scan used to be
 * unavailable. There, a reader compiled to WebAssembly (zxing, through the
 * `barcode-detector` ponyfill) takes over. It is loaded only on those browsers,
 * only when the scan starts, and its .wasm file is served by the app itself:
 * by default the library would fetch it from a public CDN.
 */
import type { BarcodeFormat } from 'barcode-detector/ponyfill'

export interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike
  }
}

export interface ReaderChoice {
  detector: BarcodeDetectorLike
  /** True when the app's own reader stands in for the browser's (said on screen). */
  builtIn: boolean
}

export async function createBarcodeDetector(formats: string[]): Promise<ReaderChoice> {
  if (window.BarcodeDetector) {
    return { detector: new window.BarcodeDetector({ formats }), builtIn: false }
  }
  const [{ BarcodeDetector, setZXingModuleOverrides }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  setZXingModuleOverrides({
    locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
  })
  return {
    detector: new BarcodeDetector({ formats: formats as BarcodeFormat[] }),
    builtIn: true,
  }
}
