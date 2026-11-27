'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { AlertTriangle, Check, ChevronLeft, QrCode, Search, Undo2 } from 'lucide-react'
import { MOCK_REQUESTED, checkInSeats, getAdminMode, getCheckInBooking, lookupCheckIn, undoCheckIn, type AdminBooking, type CheckInBooking, type CheckInError, type CheckInState } from '@/lib/admin-api'
import { tokenFromQr } from '@/lib/checkin-code'
import { manilaClock, matchesSearch, seatsByRow, sortSeats } from './format'
import type { CheckInPage } from './shell'

// Event-day check-in (#checkin). Phone-first: one thing on screen at a time.
// Start (counter, Scan QR code, search) → Scan → Result (seats, allergies, Check in N guests)
// → Checked in → Scan next guest. Every database step goes through lib/admin-api.

type Screen =
  | { kind: 'start' }
  | { kind: 'scan' }
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'error'; error: CheckInError; retry: () => void }
  | { kind: 'result'; booking: CheckInBooking; notice?: string }
  | { kind: 'done'; booking: CheckInBooking; changed: string[]; missed: string[] }

const ERRORS: Record<CheckInError, string> = {
  not_set_up: 'Check-in isn’t set up in the database yet. Please tell the team lead.',
  booking_not_found: 'This booking couldn’t be found. Search by name or reference instead.',
  booking_not_confirmed: 'Not confirmed yet, check with the team lead.',
  invalid_seats: 'Those seats don’t match this booking. Please scan again.',
  not_admin: 'This account doesn’t have admin access.',
  unknown: 'Couldn’t reach the server. Check your connection and try again.',
}

const guests = (count: number) => `${count} guest${count === 1 ? '' : 's'}`
const seatLines = (seats: string[]) => seatsByRow(seats).join('; ')

// Seats already checked in, grouped by when and by whom: "Row P · Seats 1, 2 at 4:02 PM by Jenna"
function arrivedGroups(booking: CheckInBooking) {
  const groups = new Map<string, { at: string; by: string | null; seats: string[] }>()
  for (const seat of booking.seats) {
    if (!seat.checkedInAt) continue
    const key = `${seat.checkedInAt}|${seat.checkedInBy ?? ''}`
    const group = groups.get(key) ?? { at: seat.checkedInAt, by: seat.checkedInBy, seats: [] }
    group.seats.push(seat.seatId)
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => a.at.localeCompare(b.at))
    .map(g => `${seatLines(g.seats)} at ${manilaClock(g.at)}${g.by ? ` by ${g.by}` : ''}`)
}

// Which address each screen lives at (the phone's Back goes one step back between them)
const pageFor = (screen: Screen): CheckInPage => screen.kind === 'start' ? 'checkin' : screen.kind === 'scan' ? 'checkin-scan' : 'checkin-guest'
const isGuestScreen = (screen: Screen) => pageFor(screen) === 'checkin-guest'

// Swap the current address without adding a step (no hashchange fires, so announce it)
function replacePage(page: CheckInPage) {
  if (window.location.hash === `#${page}`) return
  window.history.replaceState(window.history.state, '', `#${page}`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

type Props = {
  // The address the page is at (#checkin, #checkin-scan, #checkin-guest)
  page: CheckInPage
  bookings: AdminBooking[] | null
  state: CheckInState | null
  // After every check-in or undo: reload the counter and the search list
  onChanged: () => void
  onNoAccess: () => void
  // The camera (or anything that turns a QR into text); rendered on the Scan screen
  scanner: (onCode: (text: string) => void) => ReactNode
  // A booking to open straight away (tapped in Check-in history); onOpened clears it
  openBookingId?: string | null
  onOpened?: () => void
}

export function CheckIn({ page, bookings, state, onChanged, onNoAccess, scanner, openBookingId, onOpened }: Props) {
  const [screen, setScreen] = useState<Screen>({ kind: 'start' })
  const [query, setQuery] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const first = useRef(true)
  // One step back from the camera / a card: the start (this page added the step) or Check-in
  // history (the card was opened there); null when the page was loaded straight here
  const cameFrom = useRef<'start' | 'history' | null>(null)
  const shown = useRef<Screen>(screen)
  const lastGuest = useRef<Screen | null>(null) // reopened by the browser's Forward
  const focusSearch = useRef(false)
  // Goes up whenever the guest's card is left (or the page closes): a slow lookup or check-in
  // that finishes afterwards is ignored, so it can't pull the card back up
  const visit = useRef(0)
  useEffect(() => () => { visit.current++ }, [])

  useEffect(() => {
    shown.current = screen
    if (isGuestScreen(screen)) lastGuest.current = screen
  }, [screen])

  // Show a screen at its address. Leaving the start adds a step; camera ↔ card replaces it,
  // so Back from anywhere goes to the start (or to the history the card came from).
  const go = useCallback((next: Screen) => {
    const target = pageFor(next)
    const current = pageFor(shown.current)
    if (target !== 'checkin-guest') visit.current++
    shown.current = next
    setScreen(next)
    // Already at that address (e.g. a card opened from Check-in history): no step, keep where it came from
    if (target === current || window.location.hash === `#${target}`) return
    if (current === 'checkin') {
      cameFrom.current = 'start'
      window.location.hash = target
    } else {
      replacePage(target)
    }
  }, [])

  // Back to the start: the browser's Back when the start is the step before (no duplicate step)
  const goStart = useCallback((thenSearch = false) => {
    focusSearch.current = thenSearch
    if (shown.current.kind === 'start') { if (thenSearch) search.current?.focus(); return }
    visit.current++
    if (cameFrom.current === 'start' && window.location.hash !== '#checkin') return window.history.back()
    cameFrom.current = null
    setScreen({ kind: 'start' })
    replacePage('checkin')
  }, [])

  // "‹ History": the browser's Back when the card was opened there, else straight to it
  const goHistory = useCallback(() => {
    visit.current++
    if (cameFrom.current === 'history' && window.location.hash === '#checkin-guest') return window.history.back()
    window.location.hash = 'checkin-history'
  }, [])

  // The address changed from outside (Back, Forward, the menu, a reload): follow it
  useEffect(() => {
    if (page === pageFor(shown.current)) return
    if (page === 'checkin-guest' && openBookingId) return // opened from history: shown below
    visit.current++
    if (page === 'checkin') { cameFrom.current = null; setScreen({ kind: 'start' }); return }
    if (page === 'checkin-guest' && lastGuest.current) { setScreen(lastGuest.current); return }
    // Loaded straight at the camera or a card (nothing in memory): go to the start instead,
    // never starting the camera by itself
    cameFrom.current = null
    setScreen({ kind: 'start' })
    replacePage('checkin')
  }, [page, openBookingId])

  // Keep the phone screen on while the Check-in page is open (Wake Lock: Android Chrome,
  // iPhone Safari 16.4+). Not supported or refused: nothing happens, the screen dims as usual.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    let closed = false
    const request = () => {
      if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return
      navigator.wakeLock.request('screen').then(sentinel => { if (closed) sentinel.release(); else lock = sentinel }, () => {})
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => { closed = true; document.removeEventListener('visibilitychange', request); lock?.release() }
  }, [])

  // Each new screen: focus its heading (not on the first load, so the page title keeps focus);
  // the search box instead after "Search instead"
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (screen.kind === 'start' && focusSearch.current) { focusSearch.current = false; search.current?.focus(); return }
    heading.current?.focus()
  }, [screen])

  const fail = useCallback((error: CheckInError, retry: () => void) => {
    if (error === 'not_admin') return onNoAccess()
    go({ kind: 'error', error, retry })
  }, [onNoAccess, go])

  const openBooking = useCallback(async function open(bookingId: string) {
    go({ kind: 'loading' })
    const at = visit.current
    const result = await getCheckInBooking(bookingId)
    if (visit.current !== at) return // the card was left while looking it up
    if (!result.ok) return fail(result.error, () => open(bookingId))
    go(result.booking ? { kind: 'result', booking: result.booking } : { kind: 'error', error: 'booking_not_found', retry: () => open(bookingId) })
  }, [fail, go])

  // Opened from Check-in history (already at #checkin-guest): show that booking's card (Undo is there)
  useEffect(() => {
    if (!openBookingId) return
    cameFrom.current = 'history'
    openBooking(openBookingId)
    onOpened?.()
  }, [openBookingId, openBooking, onOpened])

  const onCode = useCallback(async function scanned(text: string) {
    const token = tokenFromQr(text)
    if (!token) return go({ kind: 'invalid' })
    go({ kind: 'loading' })
    const at = visit.current
    const result = await lookupCheckIn(token)
    if (visit.current !== at) return
    if (!result.ok) return fail(result.error, () => scanned(text))
    go(result.booking ? { kind: 'result', booking: result.booking } : { kind: 'invalid' })
  }, [fail, go])

  // Test mode only: `window.dispatchEvent(new CustomEvent('admin-mock:scan', { detail: 'W4W1:…' }))`
  // acts as if the camera read that text (the real build never has this listener)
  useEffect(() => {
    if (!MOCK_REQUESTED || screen.kind !== 'scan' || getAdminMode().kind !== 'mock') return
    const onMockScan = (event: Event) => onCode((event as CustomEvent<string>).detail)
    window.addEventListener('admin-mock:scan', onMockScan)
    return () => window.removeEventListener('admin-mock:scan', onMockScan)
  }, [screen.kind, onCode])

  const scan = () => go({ kind: 'scan' })
  const searchInstead = () => goStart(true)

  // "Looking up…" taking long (weak signal): after 10 seconds also offer the way back
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (screen.kind !== 'loading') return
    const timer = window.setTimeout(() => setSlow(true), 10_000)
    return () => { window.clearTimeout(timer); setSlow(false) }
  }, [screen])

  // "‹ History" when the card was opened from Check-in history, else "‹ Check-in". Same place
  // as the phone's Back (it uses the browser's Back when that's the step before).
  const back = cameFrom.current === 'history'
    ? <a className="admin-back" href="#checkin-history" aria-label="Back to Check-in history" onClick={event => { event.preventDefault(); goHistory() }}><ChevronLeft size={18} aria-hidden />History</a>
    : <a className="admin-back" href="#checkin" aria-label="Back to Check-in" onClick={event => { event.preventDefault(); goStart() }}><ChevronLeft size={18} aria-hidden />Check-in</a>

  // The check-in / undo is saved even if the card was left meanwhile; only the screen isn't changed
  async function confirm(booking: CheckInBooking, seats: string[]) {
    const at = visit.current
    const result = await checkInSeats(booking.bookingId, seats)
    if (visit.current !== at) return onChanged()
    if (!result.ok) {
      if (result.error === 'booking_not_confirmed') return go({ kind: 'result', booking: { ...booking, status: 'pending' } })
      return fail(result.error, () => go({ kind: 'result', booking }))
    }
    onChanged()
    // Nothing changed: someone else checked these seats in first
    if (!result.changed.length) return go({ kind: 'result', booking: result.booking })
    // Same address as the card (no new step), so Back never shows the used "Check in" button
    go({ kind: 'done', booking: result.booking, changed: result.changed, missed: seats.filter(id => !result.changed.includes(id)) })
  }

  async function undo(booking: CheckInBooking, seats: string[]) {
    const at = visit.current
    const result = await undoCheckIn(booking.bookingId, seats)
    if (visit.current !== at) return onChanged()
    if (!result.ok) return fail(result.error, () => go({ kind: 'result', booking }))
    onChanged()
    go({ kind: 'result', booking: result.booking, notice: result.changed.length ? `Check-in undone for ${seatLines(result.changed)}.` : 'Nothing to undo: those seats weren’t checked in.' })
  }

  if (screen.kind === 'scan') return <section className="admin-card admin-checkin-panel" aria-labelledby="checkin-heading">
    <h2 className="admin-checkin-heading" id="checkin-heading" ref={heading} tabIndex={-1}>Scan QR code</h2>
    {scanner(onCode)}
    <div className="admin-checkin-buttons">
      <button className="btn-ghost" type="button" onClick={searchInstead}><Search size={18} aria-hidden />Search instead</button>
      <button className="admin-text-link" type="button" onClick={() => goStart()}>Back to check-in</button>
    </div>
  </section>

  if (screen.kind === 'loading') return <section className="admin-card admin-checkin-panel" aria-busy="true">
    {slow && back}
    <h2 className="admin-checkin-heading" id="checkin-heading" ref={heading} tabIndex={-1}>Looking up…</h2>
    <p className="admin-card-text" role="status">Finding the booking.</p>
  </section>

  if (screen.kind === 'invalid') return <section className="admin-card admin-checkin-panel is-error" aria-labelledby="checkin-heading">
    {back}
    <h2 className="admin-checkin-heading" id="checkin-heading" ref={heading} tabIndex={-1}>Not a valid ticket</h2>
    <p className="admin-card-text" role="alert">This QR code isn’t a Movies4Water check-in code. Ask for the guest’s name or reference code.</p>
    <div className="admin-checkin-buttons">
      <button className="btn-primary" type="button" onClick={searchInstead}><Search size={18} aria-hidden />Search instead</button>
      <button className="btn-ghost" type="button" onClick={scan}><QrCode size={18} aria-hidden />Scan again</button>
    </div>
  </section>

  if (screen.kind === 'error') return <section className="admin-card admin-checkin-panel is-error" aria-labelledby="checkin-heading">
    {back}
    <h2 className="admin-checkin-heading" id="checkin-heading" ref={heading} tabIndex={-1}>Something went wrong</h2>
    <p className="admin-card-text" role="alert">{ERRORS[screen.error]}</p>
    <div className="admin-checkin-buttons">
      {screen.error !== 'not_set_up' && <button className="btn-primary" type="button" onClick={screen.retry}>Try again</button>}
      <button className="btn-ghost" type="button" onClick={searchInstead}><Search size={18} aria-hidden />Search instead</button>
      <button className="admin-text-link" type="button" onClick={scan}>Scan next guest</button>
    </div>
  </section>

  if (screen.kind === 'result') return <ResultCard key={screen.booking.bookingId + (screen.notice ?? '')} booking={screen.booking} notice={screen.notice} back={back} calm={cameFrom.current === 'history'} headingRef={heading} onConfirm={confirm} onUndo={undo} onNext={scan} />

  if (screen.kind === 'done') {
    const left = screen.booking.seats.filter(s => !s.checkedInAt).map(s => s.seatId)
    return <section className="admin-card admin-checkin-panel is-done" aria-labelledby="checkin-heading">
      {back}
      <span className="admin-badge is-accent admin-badge-icon"><Check size={14} aria-hidden />Checked in</span>
      <h2 className="admin-checkin-heading" id="checkin-heading" ref={heading} tabIndex={-1}>{screen.booking.fullName}</h2>
      <p className="admin-card-text is-large" role="status">{guests(screen.changed.length)} checked in: {seatLines(screen.changed)}</p>
      {screen.missed.length > 0 && <p className="admin-warning">Already checked in by someone else: {seatLines(screen.missed)}</p>}
      {left.length > 0 && <p className="admin-card-text">Still to arrive: {seatLines(left)}</p>}
      <div className="admin-checkin-buttons">
        <button className="btn-primary admin-checkin-main" type="button" onClick={scan}><QrCode size={20} aria-hidden />Scan next guest</button>
        <button className="btn-ghost" type="button" onClick={() => undo(screen.booking, screen.changed)}><Undo2 size={18} aria-hidden />Undo this check-in</button>
        <button className="admin-text-link" type="button" onClick={searchInstead}><Search size={18} aria-hidden />Search next guest</button>
      </div>
    </section>
  }

  // Start: counter, Scan, search
  const arrived = state?.arrived ?? 0
  const total = state?.total ?? 0
  const q = query.trim()
  const matches = q && bookings ? bookings.filter(b => b.status !== 'rejected' && matchesSearch(b, q))
    .sort((a, b) => Number(b.status === 'approved') - Number(a.status === 'approved') || a.fullName.localeCompare(b.fullName)) : []

  return <div className="admin-checkin">
    <section className="admin-card admin-checkin-panel" aria-labelledby="checkin-count">
      <h2 className="sr-only" ref={heading} tabIndex={-1}>Check-in</h2>
      <p className="admin-card-number" id="checkin-count" aria-live="polite">{state ? arrived : '–'} <span>of {state ? total : '–'} guests arrived</span></p>
      <div className="admin-progress" aria-hidden="true"><span style={{ width: `${total ? Math.round(arrived / total * 100) : 0}%` }} /></div>
      <button className="btn-primary admin-checkin-main" type="button" onClick={scan}><QrCode size={22} aria-hidden />Scan QR code</button>
      <a className="admin-text-link" href="#checkin-history">See who’s checked in</a>
    </section>

    <section className="admin-checkin-search" aria-labelledby="checkin-search-title">
      <h2 className="admin-checkin-subheading" id="checkin-search-title">No QR code?</h2>
      <label className="admin-search">
        <Search size={16} aria-hidden />
        <span className="sr-only">Search name or reference</span>
        <input ref={search} className="input" type="search" placeholder="Search name or reference" value={query} onChange={e => setQuery(e.target.value)} />
      </label>
      {q && !bookings && <p className="admin-empty" role="status">Loading bookings…</p>}
      {q && bookings && !matches.length && <p className="admin-empty" role="status">No booking matches “{q}”. Check the spelling, or ask the team lead.</p>}
      {matches.length > 0 && <ul className="admin-rows">
        {matches.map(b => {
          const entry = state?.bookings[b.id]
          const allIn = !!entry && entry.arrived >= entry.seats
          return <li key={b.id} className="admin-row admin-checkin-row">
            <span className="admin-row-main">
              <span className="admin-row-name">{b.fullName}</span>
              <span className="admin-row-meta">{b.referenceCode} · {seatLines(b.seatIds)}</span>
              {entry && entry.arrived > 0 && !allIn && <span className="admin-row-meta">{entry.arrived} of {entry.seats} arrived</span>}
            </span>
            {b.status !== 'approved'
              ? <span className="admin-badge is-gold">Not confirmed yet</span>
              : allIn
                ? <button className="btn-ghost admin-btn-small" type="button" onClick={() => openBooking(b.id)} aria-label={`${b.fullName}: arrived ${entry.lastAt ? manilaClock(entry.lastAt) : ''}. Open`}><Check size={16} aria-hidden />Arrived {entry.lastAt ? manilaClock(entry.lastAt) : ''}</button>
                : <button className="btn-primary admin-btn-small" type="button" onClick={() => openBooking(b.id)} aria-label={`Check in ${b.fullName}`}>Check in</button>}
          </li>
        })}
      </ul>}
    </section>
  </div>
}

type ResultProps = {
  booking: CheckInBooking
  notice?: string
  // "‹ History" or "‹ Check-in", at the top-left
  back: ReactNode
  // Opened from Check-in history: an outline "Check in N guests…" that asks first, so browsing
  // can't check anyone in by accident. From a scan or search: one big button, one tap.
  calm: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
  onConfirm: (booking: CheckInBooking, seats: string[]) => Promise<void>
  onUndo: (booking: CheckInBooking, seats: string[]) => Promise<void>
  onNext: () => void
}

// A scanned or searched booking: the seats still to arrive start selected; tap one to leave it for later
function ResultCard({ booking, notice, back, calm, headingRef, onConfirm, onUndo, onNext }: ResultProps) {
  const open = sortSeats(booking.seats.filter(s => !s.checkedInAt).map(s => s.seatId))
  const done = sortSeats(booking.seats.filter(s => s.checkedInAt).map(s => s.seatId))
  const [selected, setSelected] = useState<string[]>(open)
  const [busy, setBusy] = useState(false)
  const [askUndo, setAskUndo] = useState(false)
  const [askCheckIn, setAskCheckIn] = useState(false)
  const confirmed = booking.status === 'approved'
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(s => s !== id) : sortSeats([...current, id]))
  const run = async (action: () => Promise<void>) => { setBusy(true); await action(); setBusy(false) }

  return <section className={`admin-card admin-checkin-panel${confirmed ? '' : ' is-error'}`} aria-labelledby="checkin-heading" aria-busy={busy}>
    {back}
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    <span className="admin-ref">{booking.referenceCode}</span>
    <h2 className="admin-checkin-heading" id="checkin-heading" ref={headingRef} tabIndex={-1}>{booking.fullName}</h2>
    {calm && <p className="admin-card-text">Opened from history. Nothing changes until you confirm.</p>}

    {!confirmed ? <>
      <p className="admin-warning" role="alert"><AlertTriangle size={18} aria-hidden /> Not confirmed yet, check with the team lead.</p>
      <p className="admin-card-text">Seats on this booking: {seatLines(booking.seatIds)}. Don’t let these guests in until the team lead says so.</p>
    </> : <>
      {done.length > 0 && <div className="admin-warning" role={open.length ? undefined : 'alert'}>
        <p className="admin-checkin-warning-title"><AlertTriangle size={18} aria-hidden /> {open.length ? 'Some seats are already checked in' : 'Already checked in'}</p>
        <ul>{arrivedGroups(booking).map(line => <li key={line}>{line}</li>)}</ul>
      </div>}

      {open.length > 0 && <fieldset className="admin-seat-chips">
        <legend>Seats <span>· tap a seat to leave it for later</span></legend>
        <div>
          {open.map(id => {
            const on = selected.includes(id)
            return <button key={id} type="button" className="admin-seat-chip" aria-pressed={on} onClick={() => toggle(id)} disabled={busy}>
              {on && <Check size={16} aria-hidden />}{id}<span className="sr-only">{on ? ', checking in' : ', left for later'}</span>
            </button>
          })}
        </div>
      </fieldset>}

      {booking.foodAllergies && <div className="admin-allergies">
        <p className="admin-allergies-title">Food allergies</p>
        <p>{booking.foodAllergies}</p>
      </div>}
    </>}

    <div className="admin-checkin-buttons">
      {confirmed && open.length > 0 && !calm && <button className="btn-primary admin-checkin-main" type="button" disabled={busy || !selected.length} onClick={() => run(() => onConfirm(booking, selected))}>
        <Check size={20} aria-hidden />{busy ? 'Checking in…' : `Check in ${guests(selected.length)}`}
      </button>}
      {confirmed && open.length > 0 && calm && !askCheckIn && <button className="btn-ghost admin-checkin-main" type="button" disabled={busy || !selected.length} onClick={() => { setAskUndo(false); setAskCheckIn(true) }}>
        <Check size={20} aria-hidden />Check in {guests(selected.length)}…
      </button>}
      {askCheckIn && <div className="admin-checkin-undo" role="group" aria-label="Check in">
        <p>Check in {booking.fullName}’s {selected.length} seat{selected.length === 1 ? '' : 's'} now?</p>
        <div className="admin-checkin-buttons">
          <button className="btn-primary" type="button" disabled={busy || !selected.length} onClick={() => run(() => onConfirm(booking, selected))}>{busy ? 'Checking in…' : 'Yes, check in'}</button>
          <button className="btn-ghost" type="button" disabled={busy} onClick={() => setAskCheckIn(false)}>Keep as is</button>
        </div>
      </div>}
      {confirmed && done.length > 0 && !askUndo && <button className="btn-ghost" type="button" disabled={busy} onClick={() => { setAskCheckIn(false); setAskUndo(true) }}><Undo2 size={18} aria-hidden />Undo check-in</button>}
      {askUndo && <div className="admin-checkin-undo" role="group" aria-label="Undo check-in">
        <p>Undo check-in for {seatLines(done)}? They’ll show as not arrived.</p>
        <div className="admin-checkin-buttons">
          <button className="btn-primary" type="button" disabled={busy} onClick={() => run(() => onUndo(booking, done))}>{busy ? 'Undoing…' : 'Yes, undo'}</button>
          <button className="btn-ghost" type="button" disabled={busy} onClick={() => setAskUndo(false)}>Keep it</button>
        </div>
      </div>}
      <button className={open.length && confirmed ? 'admin-text-link' : 'btn-primary admin-checkin-main'} type="button" disabled={busy} onClick={onNext}><QrCode size={18} aria-hidden />Scan next guest</button>
    </div>
  </section>
}
