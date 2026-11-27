'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { getCheckInHistory, type CheckInHistoryEntry, type CheckInState } from '@/lib/admin-api'
import { manilaClock, manilaDay, seatsByRow } from './format'

// Check-in history (#checkin-history), read-only. Every check-in and undo, newest first
// (migration 008). The count at the top is the same one the Check-in page shows (seats checked
// in now); the list is history, so after an undo both stay true. Tapping a line opens that
// booking's card on the Check-in page, where Undo already works. No allergies or contact details.

const REFRESH_MS = 10_000

type Props = {
  state: CheckInState | null
  onOpen: (bookingId: string) => void
  onNoAccess: () => void
}

// "4:02 PM" today; "Nov 27, 4:02 PM" on another day (test check-ins before the event)
const when = (iso: string) => manilaDay(iso) === manilaDay(new Date().toISOString()) ? manilaClock(iso) : `${manilaDay(iso)}, ${manilaClock(iso)}`

export function CheckInHistory({ state, onOpen, onNoAccess }: Props) {
  const [entries, setEntries] = useState<CheckInHistoryEntry[] | null>(null)
  const [error, setError] = useState<'' | 'not_set_up' | 'failed'>('')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    const result = await getCheckInHistory()
    if (result.ok) { setEntries(result.entries); setError(''); return }
    if (result.error === 'not_admin') return onNoAccess()
    setError(result.error === 'not_set_up' ? 'not_set_up' : 'failed')
  }, [onNoAccess])

  // Every 10 seconds, like the Check-in page; not while the tab is hidden
  useEffect(() => {
    load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') load() }, REFRESH_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  const arrived = state?.arrived ?? 0
  const total = state?.total ?? 0
  const q = query.trim().toLowerCase()
  const shown = entries && q ? entries.filter(e => e.fullName.toLowerCase().includes(q) || e.referenceCode.toLowerCase().includes(q)) : entries

  return <div className="admin-checkin">
    <section className="admin-card admin-checkin-panel" aria-labelledby="history-count">
      <p className="admin-card-number" id="history-count" aria-live="polite">{state ? arrived : '–'} <span>of {state ? total : '–'} seats checked in now</span></p>
      <div className="admin-progress" aria-hidden="true"><span style={{ width: `${total ? Math.round(arrived / total * 100) : 0}%` }} /></div>
    </section>

    {error === 'not_set_up'
      ? <p className="admin-notice" role="status">Check-in history isn’t set up yet. Please tell the team lead.</p>
      : <section className="admin-checkin-search" aria-labelledby="history-title">
        <h2 className="admin-checkin-subheading" id="history-title">History: every check-in and undo, newest first</h2>
        {error === 'failed' && <p className="admin-notice is-error" role="alert">Couldn’t load the latest history. Check your connection; it retries every 10 seconds.</p>}
        <label className="admin-search">
          <Search size={16} aria-hidden />
          <span className="sr-only">Search name or reference</span>
          <input className="input" type="search" placeholder="Search name or reference" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
        {!entries && !error && <p className="admin-empty" role="status">Loading…</p>}
        {entries && !entries.length && <p className="admin-empty">No check-ins yet.</p>}
        {entries && entries.length > 0 && shown && !shown.length && <p className="admin-empty" role="status">No check-ins match “{query.trim()}”.</p>}
        {shown && shown.length > 0 && <ul className="admin-rows admin-history">
          {shown.map(entry => {
            const undone = entry.action === 'undo'
            return <li key={entry.id} className={`admin-row${undone ? ' is-undone' : ''}`}>
              <button className="admin-row-button" type="button" onClick={() => onOpen(entry.bookingId)}>
                <span className="admin-row-main">
                  <span className="admin-row-name">{undone ? 'Undone ' : ''}{when(entry.at)} · {entry.fullName}</span>
                  <span className="admin-row-meta">{entry.referenceCode} · {seatsByRow(entry.seatIds).join('; ')} · by {entry.adminName}</span>
                </span>
                <ChevronRight className="admin-row-chevron" size={18} aria-hidden />
              </button>
            </li>
          })}
        </ul>}
      </section>}
  </div>
}
