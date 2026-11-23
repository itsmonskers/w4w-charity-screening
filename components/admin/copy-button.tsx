'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'

// Moved unchanged from admin-dashboard.tsx so the guided check can use it too.
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    if (copy === 'idle') return
    const timer = window.setTimeout(() => setCopy('idle'), 2000)
    return () => window.clearTimeout(timer)
  }, [copy])
  return <>
    <button type="button" className="copy-button" aria-label={`Copy ${label}`} onClick={() => navigator.clipboard.writeText(text).then(() => setCopy('copied'), () => setCopy('failed'))}>{copy === 'copied' ? <><Check /> Copied</> : copy === 'failed' ? 'Copy failed' : <><Copy /> Copy</>}</button>
    <span className="sr-only" aria-live="polite">{copy === 'copied' ? `${label} copied` : ''}</span>
  </>
}
