'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Expand, X, ZoomIn, ZoomOut } from 'lucide-react'
import { getScreenshotUrl } from '@/lib/admin-api'
import { usePauseRefresh } from './refresh-pause'

// Payment screenshot: a preview that opens full screen inside the dashboard (modal <dialog>:
// Esc or Close shuts it and focus returns to the preview). HEIC/HEIF can't be previewed in
// most browsers, so those get a download button instead (same as before).
export function Screenshot({ path, reference, guest, large = false }: { path: string; reference: string; guest: string; large?: boolean }) {
  const [download, setDownload] = useState(/\.(heic|heif)$/i.test(path))
  const [url, setUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [viewing, setViewing] = useState(false)
  const viewer = useRef<HTMLDialogElement>(null)
  usePauseRefresh(viewing) // no auto-refresh while the full-screen viewer is open

  useEffect(() => {
    let cancelled = false
    getScreenshotUrl(path, download).then(signed => { if (!cancelled) signed ? setUrl(signed) : setMissing(true) }, () => { if (!cancelled) setMissing(true) })
    return () => { cancelled = true }
  }, [path, download])

  const size = large ? ' is-large' : ''
  if (missing) return <p className={`admin-shot-note${size}`} role="status">Couldn’t load the payment screenshot. Reload the page to try again.</p>
  if (!url) return <div className={`admin-shot is-loading${size}`}>Loading screenshot…</div>
  if (download) return <div className={`admin-shot-note${size}`}>
    <span>This screenshot can’t be previewed here.</span>
    <a className="btn-ghost admin-btn-small" href={url} download><Download size={16} aria-hidden />Download screenshot</a>
  </div>

  return <>
    <button type="button" className={`admin-shot${size}`} aria-haspopup="dialog" onClick={() => { setZoomed(false); viewer.current?.showModal(); setViewing(true) }}>
      <img src={url} alt={`Payment screenshot from ${guest} (${reference})`} onError={() => { setUrl(null); setDownload(true) }} />
      <span className="admin-shot-hint"><Expand size={16} aria-hidden />View full screen</span>
    </button>
    <dialog ref={viewer} className="admin-viewer" aria-label={`Payment screenshot from ${guest}`} onClose={() => setViewing(false)}>
      <div className="admin-viewer-bar">
        <span>{guest} · {reference}</span>
        <div className="admin-viewer-actions">
          <button className="btn-ghost admin-btn-small" type="button" onClick={() => setZoomed(z => !z)}>{zoomed ? <><ZoomOut size={16} aria-hidden />Fit to screen</> : <><ZoomIn size={16} aria-hidden />Zoom in</>}</button>
          <button className="btn-ghost admin-btn-small" type="button" onClick={() => viewer.current?.close()}><X size={16} aria-hidden />Close</button>
        </div>
      </div>
      <div className={`admin-viewer-image${zoomed ? ' is-zoomed' : ''}`}>
        <img src={url} alt={`Payment screenshot from ${guest} (${reference}), full screen`} />
      </div>
    </dialog>
  </>
}
