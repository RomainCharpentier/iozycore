import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff } from 'lucide-react'
import { createBarcodeDetector, type BarcodeDetectorLike } from './barcodeDetector'

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']
/** Avoids firing the same code again while it stays in the frame -
  * without it, pointing the camera at the same volume for 2 seconds adds it in a loop. */
const RESCAN_COOLDOWN_MS = 3000

/**
  * "Quick add by scan" (brainstorm) - scans several barcodes in a row
  * with the camera, one `onScan(code)` per detected code (deduplicated
  * during the cooldown). It does NO lookup or add itself - the
  * parent (ScanPage) orchestrates lookupBarcode + quickAdd, and this component
  * only handles the camera and detection mechanics.
 */
export function CameraBarcodeScanner({ onScan }: { onScan: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastSeenRef = useRef<Map<string, number>>(new Map())
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [builtIn, setBuiltIn] = useState(false)

  // Every browser can read a barcode now (see barcodeDetector); what can be missing is the camera.
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  useEffect(() => {
    return () => stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function detectLoop() {
    const video = videoRef.current
    const detector = detectorRef.current
    if (!video || !detector) return

    detector
      .detect(video)
      .then((results) => {
        const now = Date.now()
        for (const result of results) {
          const lastSeen = lastSeenRef.current.get(result.rawValue)
          if (lastSeen && now - lastSeen < RESCAN_COOLDOWN_MS) continue
          lastSeenRef.current.set(result.rawValue, now)
          onScan(result.rawValue)
        }
      })
      .catch(() => {
        // Best-effort by nature - an unreadable frame must never interrupt the stream.
      })
      .finally(() => {
        rafRef.current = requestAnimationFrame(detectLoop)
      })
  }

  async function start() {
    setError(null)
    setPreparing(true)
    let reader
    try {
      reader = await createBarcodeDetector(BARCODE_FORMATS)
    } catch {
      setPreparing(false)
      setError('Le lecteur de code-barres n’a pas pu se charger. Saisis le code ci-dessous.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      detectorRef.current = reader.detector
      setBuiltIn(reader.builtIn)
      setScanning(true)
      rafRef.current = requestAnimationFrame(detectLoop)
    } catch {
      setError("Impossible d'accéder à la caméra - vérifie les autorisations du navigateur.")
    } finally {
      setPreparing(false)
    }
  }

  function stop() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    detectorRef.current = null
    setScanning(false)
  }

  if (!supported) {
    return (
      <p className="rounded-xl bg-surface p-3 text-sm text-textDim">
        Ce navigateur ne donne pas accès à la caméra : saisis le code-barres ci-dessous.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} className={`w-full ${scanning ? 'block' : 'hidden'}`} muted playsInline />
        {!scanning && <div className="flex h-48 items-center justify-center text-sm text-textDim">Caméra arrêtée</div>}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
      {/* The fallback is said, like every fallback of the app. */}
      {scanning && builtIn && (
        <p className="text-xs text-textDim">Lecteur intégré à l’app : ce navigateur n’a pas le sien.</p>
      )}

      <button
        type="button"
        onClick={scanning ? stop : start}
        disabled={preparing}
        className="btn-primaire"
      >
        {scanning ? <CameraOff size={16} /> : <Camera size={16} />}
        {scanning ? 'Arrêter le scan' : preparing ? 'Préparation du lecteur…' : 'Démarrer le scan'}
      </button>
    </div>
  )
}
