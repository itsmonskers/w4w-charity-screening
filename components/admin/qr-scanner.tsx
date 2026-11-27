'use client'

import { useEffect, useRef, useState } from 'react'

// Camera QR scanner for check-in. Uses the phone's back camera (getUserMedia, HTTPS only,
// which the live site has; localhost also counts) and jsQR, loaded only when this opens.
// Reads about 5 frames a second; the first code found is passed to onCode, then it stops.
// The camera is switched off when this closes, and while the tab is hidden.

type Status = 'starting' | 'scanning' | 'blocked' | 'no-camera' | 'unsupported' | 'failed'

const MESSAGES: Record<Status, string> = {
  starting: 'Starting the camera…',
  scanning: 'Point the camera at the guest’s QR code.',
  blocked: 'Camera access is blocked. Allow the camera for this site in your browser settings, then try again, or use Search instead.',
  'no-camera': 'No camera was found on this device. Use Search instead.',
  unsupported: 'This browser can’t use the camera here. Open this page in Safari or Chrome (not inside Messenger or another app), or use Search instead.',
  failed: 'The camera couldn’t start. Try again, or use Search instead.',
}

const FRAME_MS = 200
// Frames are scaled down to this width before reading: faster, and plenty for a phone-sized QR
const READ_WIDTH = 640

export function QrScanner({ onCode }: { onCode: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const onCodeRef = useRef(onCode)
  const [status, setStatus] = useState<Status>('starting')
  const [attempt, setAttempt] = useState(0)
  const [hidden, setHidden] = useState(false)

  useEffect(() => { onCodeRef.current = onCode }, [onCode])

  // Tab hidden: camera off. Visible again: it starts again (the effect below re-runs)
  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (hidden) return
    let stream: MediaStream | null = null
    let timer = 0
    let stopped = false
    const stop = () => { stopped = true; window.clearTimeout(timer); stream?.getTracks().forEach(track => track.stop()) }

    async function start() {
      setStatus('starting')
      if (!navigator.mediaDevices?.getUserMedia) return setStatus('unsupported')
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } })
      } catch (error) {
        const name = error instanceof DOMException ? error.name : ''
        if (stopped) return
        return setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'blocked' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'no-camera' : 'failed')
      }
      if (stopped) return stream.getTracks().forEach(track => track.stop())
      const el = video.current
      if (!el) return stop()
      el.srcObject = stream
      try { await el.play() } catch { /* autoplay with muted + playsInline normally works; reading still runs */ }
      const { default: jsQR } = await import('jsqr')
      if (stopped) return
      setStatus('scanning')
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d', { willReadFrequently: true })
      const read = () => {
        if (stopped || !context) return
        if (el.videoWidth) {
          const scale = Math.min(1, READ_WIDTH / el.videoWidth)
          canvas.width = Math.round(el.videoWidth * scale)
          canvas.height = Math.round(el.videoHeight * scale)
          context.drawImage(el, 0, 0, canvas.width, canvas.height)
          const frame = context.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' })
          if (code?.data) { stop(); return onCodeRef.current(code.data) }
        }
        timer = window.setTimeout(read, FRAME_MS)
      }
      read()
    }

    start()
    return stop
  }, [attempt, hidden])

  const problem = status !== 'starting' && status !== 'scanning'
  return <div className="admin-scanner">
    <div className={`admin-scanner-view${problem ? ' is-off' : ''}`}>
      <video ref={video} className="admin-scanner-video" playsInline muted aria-hidden="true" />
      <span className="admin-scanner-frame" aria-hidden="true" />
    </div>
    <p className={`admin-scanner-note${problem ? ' is-error' : ''}`} role={problem ? 'alert' : 'status'}>{MESSAGES[status]}</p>
    {(status === 'blocked' || status === 'failed') && <button className="btn-ghost" type="button" onClick={() => setAttempt(n => n + 1)}>Try the camera again</button>}
  </div>
}
