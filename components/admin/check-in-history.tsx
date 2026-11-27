'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { getCheckInHistory, type AdminBooking, type CheckInHistoryEntry, type CheckInState } from '@/lib/admin-api'
import { manilaClock, manilaDay, seatsByRow } from './format'

// Check-in history (#checkin-history), read-only. Three tabs under the count (opens on the first):
// - Not arrived yet: confirmed bookings not fully checked in, A–Z; partly arrived ones say "2 of 3 arrived"
// - Arrived: confirmed bookings with every seat checked in, latest arrival first
// - History: every check-in and undo, newest first (migration 008)
// The count is the same one the Check-in page shows (seats checked in now). Tapping a row opens
// that booking's card on the Check-in page in calm mode, where Undo already works. The tab and
// the search are kept by the dashboard, so they're still there after "‹ History".
// No allergies or contact details, and search only looks at the name and reference.

const REFRESH_MS = 10_000

export type HistoryTab = 'arrived' | 'waiting' | 'history'
export type HistoryView = { tab: HistoryTab; query: string }
export const HISTORY_VIEW: HistoryView = { tab: 'waiting', query: '' }

const TABS: { id: HistoryTab; label: string }[] = [
  { id: 'waiting', label: 'Not arrived yet' },
  { id: 'arrived', label: 'Arrived' },
  { id: 'history', label: 'History' },
]

type Props = {
  bookings: AdminBooking[] | null
  state: CheckInState | null
  view: HistoryView
  onView: (view: HistoryView) => void
  onOpen: (bookingId: string) => void
  onNoAccess: () => void
}

// "4:02 PM" today; "Nov 27, 4:02 PM" on another day (test check-ins before the event)
const when = (iso: string) => manilaDay(iso) === manilaDay(new Date().toISOString()) ? manilaClock(iso) : `${manilaDay(iso)}, ${manilaClock(iso)}`
const matches = (item: { fullName: string; referenceCode: string }, q: string) => item.fullName.toLowerCase().includes(q) || item.referenceCode.toLowerCase().includes(q)
const bookingsText = (count: number) => `${count} booking${count === 1 ? '' : 's'}`

export function CheckInHistory({ bookings, state, view, onView, onOpen, onNoAccess }: Props) {
  const [entries, setEntries] = useState<CheckInHistoryEntry[] | null>(null)
  const [error, setError] = useState<'' | 'not_set_up' | 'failed'>('')
  const tabs = useRef<(HTMLButtonElement | null)[]>([])

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

  const { tab, query } = view
  const arrived = state?.arrived ?? 0
  const total = state?.total ?? 0
  const q = query.trim().toLowerCase()

  // Confirmed bookings with their arrived seats (from the counter the page already loads)
  const confirmed = bookings && state ? bookings.filter(b => b.status === 'approved').map(b => {
    const entry = state.bookings[b.id]
    const seats = entry?.seats ?? b.seatIds.length
    return { booking: b, seats, arrived: entry?.arrived ?? 0, lastAt: entry?.lastAt ?? null }
  }) : null
  const allIn = confirmed?.filter(c => c.seats > 0 && c.arrived >= c.seats).sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? '')) ?? null
  const notYet = confirmed?.filter(c => !(c.seats > 0 && c.arrived >= c.seats)).sort((a, b) => a.booking.fullName.localeCompare(b.booking.fullName)) ?? null
  const list = tab === 'arrived' ? allIn : notYet
  const shownList = list && q ? list.filter(c => matches(c.booking, q)) : list
  const shownEntries = entries && q ? entries.filter(e => matches(e, q)) : entries

  // Arrow keys move between the tabs (and open them), like any tab list
  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : null
    if (next === null) return
    event.preventDefault()
    const to = (next + TABS.length) % TABS.length
    onView({ ...view, tab: TABS[to].id })
    tabs.current[to]?.focus()
  }

  const countLine = tab === 'history'
    ? 'History: every check-in and undo, newest first'
    : !list ? 'Loading…'
    : tab === 'arrived' ? `${bookingsText(list.length)} fully arrived`
    : `${bookingsText(list.length)} still to arrive`

  return <div className="admin-checkin">
    <section className="admin-card admin-checkin-panel" aria-labelledby="history-count">
      <p className="admin-card-number" id="history-count" aria-live="polite">{state ? arrived : '–'} <span>of {state ? total : '–'} seats checked in now</span></p>
      <div className="admin-progress" aria-hidden="true"><span style={{ width: `${total ? Math.round(arrived / total * 100) : 0}%` }} /></div>
    </section>

    <div className="admin-tabs" role="tablist" aria-label="Show">
      {TABS.map((t, index) => <button key={t.id} ref={el => { tabs.current[index] = el }} className="admin-tab" type="button" role="tab" id={`history-tab-${t.id}`} aria-selected={tab === t.id} aria-controls="history-panel" tabIndex={tab === t.id ? 0 : -1} onClick={() => onView({ ...view, tab: t.id })} onKeyDown={event => onTabKey(event, index)}>{t.label}</button>)}
    </div>

    <section className="admin-checkin-search" id="history-panel" role="tabpanel" aria-labelledby={`history-tab-${tab}`}>
      <p className="admin-checkin-subheading" role="status">{countLine}</p>
      {tab === 'history' && error === 'not_set_up'
        ? <p className="admin-notice" role="status">Check-in history isn’t set up yet. Please tell the team lead.</p>
        : <>
          {tab === 'history' && error === 'failed' && <p className="admin-notice is-error" role="alert">Couldn’t load the latest history. Check your connection; it retries every 10 seconds.</p>}
          <label className="admin-search">
            <Search size={16} aria-hidden />
            <span className="sr-only">Search name or reference</span>
            <input className="input" type="search" placeholder="Search name or reference" value={query} onChange={e => onView({ ...view, query: e.target.value })} />
          </label>

          {tab === 'history' ? <>
            {!entries && !error && <p className="admin-empty" role="status">Loading…</p>}
            {entries && !entries.length && <p className="admin-empty">No check-ins yet.</p>}
            {entries && entries.length > 0 && shownEntries && !shownEntries.length && <p className="admin-empty" role="status">No check-ins match “{query.trim()}”.</p>}
            {shownEntries && shownEntries.length > 0 && <ul className="admin-rows admin-history">
              {shownEntries.map(entry => {
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
          </> : <>
            {list && !list.length && <p className="admin-empty">{tab === 'arrived' ? 'No bookings have fully arrived yet.' : 'Every confirmed booking has arrived.'}</p>}
            {list && list.length > 0 && shownList && !shownList.length && <p className="admin-empty" role="status">No bookings match “{query.trim()}”.</p>}
            {shownList && shownList.length > 0 && <ul className="admin-rows admin-history">
              {shownList.map(({ booking, seats, arrived: count, lastAt }) => <li key={booking.id} className="admin-row">
                <button className="admin-row-button" type="button" onClick={() => onOpen(booking.id)}>
                  <span className="admin-row-main">
                    <span className="admin-row-name">{booking.fullName}</span>
                    <span className="admin-row-meta">{booking.referenceCode} · {seatsByRow(booking.seatIds).join('; ')}</span>
                    {tab === 'arrived' && lastAt && <span className="admin-row-meta">Arrived {when(lastAt)}</span>}
                  </span>
                  {tab === 'waiting' && count > 0 && <span className="admin-badge is-gold">{count} of {seats} arrived</span>}
                  <ChevronRight className="admin-row-chevron" size={18} aria-hidden />
                </button>
              </li>)}
            </ul>}
          </>}
        </>}
    </section>
  </div>
}
