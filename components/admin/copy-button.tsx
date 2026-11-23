'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'

// Moved from admin-dashboard.tsx so every admin screen can use it. `children` replaces the
// visible "Copy" (e.g. "Copy email text"); `label` names what is copied for screen readers.
export function CopyButton({ text, label, children = 'Copy' }: { text: string; label: string; children?: string }) {
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    if (copy === 'idle') return
    const timer = window.setTimeout(() => setCopy('idle'), 2000)
    return () => window.clearTimeout(timer)
  }, [copy])
  return <>
    <button type="button" className="copy-button" aria-label={`Copy ${label}`} onClick={() => navigator.clipboard.writeText(text).then(() => setCopy('copied'), () => setCopy('failed'))}>{copy === 'copied' ? <><Check /> Copied</> : copy === 'failed' ? 'Copy failed' : <><Copy /> {children}</>}</button>
    <span className="sr-only" aria-live="polite">{copy === 'copied' ? `${label} copied` : ''}</span>
  </>
}
