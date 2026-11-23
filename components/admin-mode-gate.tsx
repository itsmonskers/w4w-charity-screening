'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { MOCK_REQUESTED, getAdminMode, type AdminMode } from '@/lib/admin-api'

// Normal builds: renders the admin exactly as before. Test mode (NEXT_PUBLIC_ADMIN_MOCK=true):
// shows the FAKE DATA banner on localhost, or an error screen anywhere else (never the real admin).
export function AdminModeGate({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AdminMode | null>(null)
  useEffect(() => { if (MOCK_REQUESTED) setMode(getAdminMode()) }, [])

  if (!MOCK_REQUESTED) return children
  if (!mode) return <main className="admin"><p className="admin-status" role="status">Checking test mode…</p></main>
  if (mode.kind !== 'mock') return <main className="admin">
    <div className="admin-login" role="alert">
      <div>
        <p className="eyebrow-caps">Movies4Water · Admin</p>
        <h1>Test mode blocked</h1>
      </div>
      <p className="field-error">{mode.kind === 'blocked' ? mode.reason : 'Test mode is not available.'}</p>
      <p className="field-hint">Nothing was loaded and nothing was changed. The real admin is not available in a test-mode build.</p>
    </div>
  </main>
  return <>
    <div className="preview-notice" role="note"><strong>FAKE DATA</strong> · Test mode: invented bookings, nothing is saved and no emails are sent. Sign in with any email; the password &quot;wrong&quot; tests the error.</div>
    {children}
  </>
}
