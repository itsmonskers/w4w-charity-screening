'use client'

import { useEffect, useState } from 'react'
import { Waves } from 'lucide-react'

// Swap point for the official logo [LOGO TBD]: add the reversed (light-on-dark)
// file as public/w4w-logo.svg and it replaces the wordmark automatically.
const LOGO_SRC = '/w4w-logo.svg'
const NAME = 'Waves for Water Philippines'

export function W4WLogo() {
  const [hasFile, setHasFile] = useState(false)
  useEffect(() => {
    const probe = new Image()
    probe.onload = () => setHasFile(true)
    probe.src = LOGO_SRC
    return () => { probe.onload = null }
  }, [])
  return <div className="title-logo">
    {hasFile ? <img src={LOGO_SRC} alt={NAME} /> : <><Waves aria-hidden="true" /><span>{NAME}</span></>}
  </div>
}
