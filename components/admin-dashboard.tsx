'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { ADMIN_AVAILABLE, checkIsAdmin, getBookings, getCheckInState, getSeatCounts, onAuthChange, signIn, signOut, type AdminBooking, type CheckInState, type SeatCounts } from '@/lib/admin-api'
import { formatPrice } from '@/lib/event-config'
import { BookingList } from './admin/booking-lists'
import { CheckIn } from './admin/check-in'
import { CheckInHistory, HISTORY_VIEW, type HistoryView } from './admin/check-in-history'
import { QrScanner } from './admin/qr-scanner'
import { SendQrEmails } from './admin/send-qr-emails'
import { CopyButton } from './admin/copy-button'
import { EmailWarnings, NoQrNotes, type EmailWarningItem } from './admin/email-warning'
import { GuidedCheck } from './admin/guided-check'
import { AdminHome } from './admin/home'
import { RefreshPauseContext } from './admin/refresh-pause'
import { ReviewStep, outcomeNotice, type StepKind, type StepOutcome } from './admin/review-steps'
import { Screenshot } from './admin/screenshot'
import { AdminShell, isCheckInPage, type AdminRoute } from './admin/shell'
import { exportApproved, formatTime, manilaTime, matchesSearch, seatLabel, seatsByRow } from './admin/format'

const REFRESH_MS = 30_000
// Check-in and Check-in history: the arrived counter refreshes faster, since several phones scan at once
const CHECKIN_REFRESH_MS = 10_000
const NO_ACCESS = 'This account doesn’t have admin access.'
// #check is the guided check; #waiting keeps the full cards; #confirmed and #not-approved are simple lists.
const TITLES: Record<AdminRoute, string> = { home: 'Home', checkin: 'Check-in', 'checkin-scan': 'Check-in', 'checkin-guest': 'Check-in', 'checkin-history': 'Check-in history', check: 'Waiting for review', waiting: 'All waiting bookings', confirmed: 'Confirmed', 'not-approved': 'Not approved', 'qr-emails': 'Send check-in QR codes' }

// Pages live in the URL hash (#home, #check, #confirmed, #not-approved) so the phone's Back button works.
function readRoute(): AdminRoute {
  const hash = typeof window === 'undefined' ? '' : window.location.hash.slice(1)
  return Object.prototype.hasOwnProperty.call(TITLES, hash) ? hash as AdminRoute : 'home'
}

export function AdminDashboard() {
  // undefined while the saved session loads, null when signed out
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loginError, setLoginError] = useState('')

  useEffect(() => ADMIN_AVAILABLE ? onAuthChange(setEmail) : undefined, [])

  useEffect(() => {
    setIsAdmin(false)
    if (email == null) return
    let cancelled = false
    const deny = (message: string) => { if (!cancelled) { setLoginError(message); signOut() } }
    checkIsAdmin().then(ok => ok ? !cancelled && setIsAdmin(true) : deny(NO_ACCESS), () => deny('Couldn’t check admin access. Please sign in again.'))
    return () => { cancelled = true }
  }, [email])

  const denyAccess = useCallback(() => { setLoginError(NO_ACCESS); signOut() }, [])

  if (!ADMIN_AVAILABLE) return <main className="admin"><p className="admin-status">Admin needs the Supabase connection. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.</p></main>
  if (email === null) return <main className="admin"><Login error={loginError} onError={setLoginError} /></main>
  if (email === undefined || !isAdmin) return <main className="admin"><p className="admin-status" role="status">Checking access…</p></main>
  return <main className="admin"><Dashboard email={email} onNoAccess={denyAccess} /></main>
}

function Login({ error, onError }: { error: string; onError: (message: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    onError('')
    const result = await signIn(email, password)
    setBusy(false)
    if (!result.ok) onError(result.error === 'invalid_credentials' ? 'Email or password is incorrect.' : 'Couldn’t sign in. Check your connection and try again.')
  }

  return <form className="admin-login" onSubmit={submit}>
    <div>
      <p className="eyebrow-caps">Movies4Water</p>
      <h1>Admin sign in</h1>
    </div>
    <div className="field">
      <label className="field-label" htmlFor="admin-email">Email</label>
      <input className="input" id="admin-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
    </div>
    <div className="field">
      <label className="field-label" htmlFor="admin-password">Password</label>
      <input className="input" id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
    <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
  </form>
}

// A list card showing the confirm / not-approved step instead of its buttons
type Review = { kind: StepKind; bookingId: string }
type Notice = { message: string; error?: boolean; handled?: boolean }

function Dashboard({ email, onNoAccess }: { email: string; onNoAccess: () => void }) {
  const [bookings, setBookings] = useState<AdminBooking[] | null>(null)
  const [seats, setSeats] = useState<SeatCounts | null>(null)
  const [checkIn, setCheckIn] = useState<CheckInState | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [route, setRoute] = useState<AdminRoute>(readRoute)
  const [query, setQuery] = useState('')
  const title = useRef<HTMLHeadingElement>(null)
  const firstRoute = useRef(true)
  const [review, setReview] = useState<Review | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  // Emails that didn't send: kept (across pages) until each one is dismissed
  const [warnings, setWarnings] = useState<EmailWarningItem[]>([])
  // Confirmed emails sent without the QR image: kept (across pages) until dismissed
  const [noQr, setNoQr] = useState<AdminBooking[]>([])
  // A booking tapped in Check-in history: the Check-in page opens its card (#checkin-guest, one
  // step after the history, so Back returns there)
  const [openCheckIn, setOpenCheckIn] = useState<string | null>(null)
  const clearOpenCheckIn = useCallback(() => setOpenCheckIn(null), [])
  // Check-in history's tab and search: kept while a card opened from it is shown (so "‹ History"
  // comes back to the same list), reset on leaving Event day's pages
  const [historyView, setHistoryView] = useState<HistoryView>(HISTORY_VIEW)
  const openFromHistory = useCallback((bookingId: string) => {
    setOpenCheckIn(bookingId)
    window.location.hash = 'checkin-guest'
  }, [])
  // The guided check is on its All done screen: title "Payment check", and the calm
  // "someone else already handled" message is cleared
  const [checkDone, setCheckDone] = useState(false)
  const onAllDone = useCallback((done: boolean) => {
    setCheckDone(done)
    if (done) setNotice(current => current?.handled ? null : current)
  }, [])

  // Things that pause the auto-refresh: open steps / viewer / menu (counted), and a hidden tab
  const [pauses, setPauses] = useState(0)
  const [hidden, setHidden] = useState(false)
  const pausesNow = useRef(0)
  const lastLoad = useRef(0)
  const inFlight = useRef<Promise<void> | null>(null)
  const pause = useCallback(() => {
    pausesNow.current++
    setPauses(pausesNow.current)
    return () => { pausesNow.current--; setPauses(pausesNow.current) }
  }, [])

  // Only the Refresh button shows "Refreshing…"; automatic refreshes are silent (no flicker).
  // One load at a time: pressing Refresh during a load waits for that load.
  const refresh = useCallback(async (manual = false) => {
    if (manual) setLoading(true)
    if (!inFlight.current) {
      lastLoad.current = Date.now()
      inFlight.current = (async () => {
        try {
          // The check-in counter never blocks the payment data: if it fails, the last one stays
          const [seatCounts, rows, arrivals] = await Promise.all([getSeatCounts(), getBookings(), getCheckInState().catch(() => null)])
          setSeats(seatCounts)
          setBookings(rows)
          if (arrivals) setCheckIn(arrivals)
          setUpdatedAt(manilaTime.format(new Date()))
          setLoadError('')
        } catch {
          setLoadError('Couldn’t load the latest data. Check your connection; it retries every 30 seconds.')
        } finally {
          inFlight.current = null
        }
      })()
    }
    await inFlight.current
    if (manual) setLoading(false)
  }, [])

  // Every 30 seconds (10 on Check-in), but not while paused. After a pause, refresh straight
  // away only if one is due.
  const paused = pauses > 0 || hidden
  const checkInPage = isCheckInPage(route)
  const every = checkInPage || route === 'checkin-history' ? CHECKIN_REFRESH_MS : REFRESH_MS
  useEffect(() => {
    if (paused) return
    let timer = 0
    const tick = () => { refresh(); timer = window.setTimeout(tick, every) }
    timer = window.setTimeout(tick, Math.max(0, lastLoad.current + every - Date.now()))
    return () => window.clearTimeout(timer)
  }, [paused, refresh, every])

  // Hidden browser tab: pause. Visible again: refresh once (unless a step, viewer or menu is open).
  useEffect(() => {
    const onVisibility = () => {
      const isHidden = document.visibilityState === 'hidden'
      if (!isHidden && pausesNow.current === 0) refresh()
      setHidden(isHidden)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [refresh])

  useEffect(() => {
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // On every page change (not the first load): clear the last result message and the search,
  // close any open step, back to the top, focus on the page title. Email warnings stay.
  // Between Check-in's own steps only scroll to the top: Check-in stays open and focuses its card.
  const lastRoute = useRef(route)
  useEffect(() => {
    const previous = lastRoute.current
    lastRoute.current = route
    if (firstRoute.current) { firstRoute.current = false; return }
    if (isCheckInPage(previous) && isCheckInPage(route)) { window.scrollTo(0, 0); return }
    setNotice(null)
    setQuery('')
    if (!isCheckInPage(route) && route !== 'checkin-history') setHistoryView(HISTORY_VIEW)
    setReview(null)
    window.scrollTo(0, 0)
    title.current?.focus()
  }, [route])

  const all = bookings ?? []
  const waiting = all.filter(b => b.status === 'pending' && matchesSearch(b, query)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const navCounts = bookings && { pending: all.filter(b => b.status === 'pending').length, approved: all.filter(b => b.status === 'approved').length, rejected: all.filter(b => b.status === 'rejected').length, checkIn: checkIn ? `${checkIn.arrived}/${checkIn.total}` : undefined }

  // Every confirm / not-approved result (guided check or list): message, email warning, reload
  function handleOutcome(outcome: StepOutcome, booking: AdminBooking) {
    setNotice(outcomeNotice(outcome, booking))
    if (outcome.kind === 'done' && !outcome.emailSent) {
      setWarnings(current => [...current, { key: `${booking.id}-${Date.now()}`, kind: outcome.action === 'approve' ? 'approved' : 'rejected', booking, receipt: outcome.receipt }])
    }
    if (outcome.kind === 'done' && outcome.withoutQr) setNoQr(current => [...current.filter(b => b.id !== booking.id), booking])
    refresh()
  }

  // A list card's step finished: the card leaves this list on refresh, so focus goes to the page title
  function finishListReview(outcome: StepOutcome, booking: AdminBooking) {
    setReview(null)
    handleOutcome(outcome, booking)
    window.scrollTo(0, 0)
    title.current?.focus()
  }

  return <RefreshPauseContext.Provider value={pause}><AdminShell route={route} counts={navCounts} email={email} onExport={() => bookings && exportApproved(bookings)} onSignOut={() => signOut()}>
    <header className="admin-page-head">
      <h1 ref={title} tabIndex={-1}>{route === 'check' && checkDone ? 'Payment check' : TITLES[route]}</h1>
      {route === 'home' && <p className="admin-lede">Here’s what needs you today.</p>}
    </header>

    {route !== 'home' && route !== 'check' && !checkInPage && route !== 'checkin-history' && route !== 'qr-emails' && <div className="admin-toolbar">
      <label className="admin-search">
        <Search size={16} aria-hidden />
        <span className="sr-only">Search bookings</span>
        <input className="input" type="search" placeholder="Search name, payer, phone, email or reference" value={query} onChange={e => setQuery(e.target.value)} />
      </label>
      <button className="btn-ghost admin-btn-small" type="button" onClick={() => refresh(true)} disabled={loading}><RefreshCw size={16} aria-hidden />{loading ? 'Refreshing…' : 'Refresh'}</button>
    </div>}
    <p className="admin-updated">{updatedAt ? `Updated ${updatedAt} · refreshes every ${every / 1000} seconds` : 'Loading…'}</p>

    {loadError && <p className="admin-notice is-error" role="alert">{loadError}</p>}
    <EmailWarnings warnings={warnings} onDismiss={key => setWarnings(current => current.filter(w => w.key !== key))} onAllDismissed={() => title.current?.focus()} />
    <NoQrNotes bookings={noQr} onDismiss={id => { setNoQr(current => current.filter(b => b.id !== id)); title.current?.focus() }} />
    {notice && <p className={`admin-notice${notice.error ? ' is-error' : ''}`} role="status">{notice.message}</p>}

    {route === 'home' ? <AdminHome bookings={bookings} seats={seats} />
      : isCheckInPage(route) ? <CheckIn page={route} bookings={bookings} state={checkIn} onChanged={() => refresh()} onNoAccess={onNoAccess} scanner={onCode => <QrScanner onCode={onCode} />} openBookingId={openCheckIn} onOpened={clearOpenCheckIn} />
      : route === 'checkin-history' ? <CheckInHistory bookings={bookings} state={checkIn} view={historyView} onView={setHistoryView} onOpen={openFromHistory} onNoAccess={onNoAccess} />
      : route === 'qr-emails' ? <SendQrEmails bookings={bookings} />
      : route === 'check' ? <GuidedCheck bookings={bookings} onOutcome={handleOutcome} onClearNotice={() => setNotice(null)} onNoAccess={onNoAccess} onAllDone={onAllDone} openWarnings={warnings.map(w => w.booking.id)} />
      : route === 'confirmed' ? <BookingList bookings={bookings} status="approved" query={query} />
      : route === 'not-approved' ? <BookingList bookings={bookings} status="rejected" query={query} />
      : <div className="admin-list">
        {bookings && !waiting.length && <p className="admin-empty">{query.trim() ? 'No bookings match your search.' : 'No bookings are waiting for review.'}</p>}
        {waiting.map(booking => review?.bookingId === booking.id
          // Approve / Reject open the same confirm / not-approved steps as the guided check
          ? <ReviewStep key={booking.id + review.kind} kind={review.kind} booking={booking} onBack={() => setReview(null)} onSkip={() => setReview(null)} onDone={outcome => finishListReview(outcome, booking)} onNoAccess={onNoAccess} />
          : <BookingCard key={booking.id} booking={booking} onReview={kind => { setNotice(null); setReview({ kind, bookingId: booking.id }) }} />)}
      </div>}
  </AdminShell></RefreshPauseContext.Provider>
}

function BookingCard({ booking, onReview }: { booking: AdminBooking; onReview: (kind: StepKind) => void }) {
  return <article className="admin-booking">
    <header className="admin-booking-head">
      <div>
        <span className="admin-ref">{booking.referenceCode}</span>
        <p className="admin-name">{booking.fullName}</p>
      </div>
      <div className="admin-amount">
        <strong>{formatPrice(booking.amount)}</strong>
        <span>{seatLabel(booking.seatCount)}</span>
      </div>
    </header>
    <div className="admin-payment">
      <span className="admin-payment-label">Payment ref</span>
      <span className="admin-payment-ref">{booking.paymentRef ?? '–'}</span>
      {booking.paymentRef && <CopyButton text={booking.paymentRef} label="payment reference" />}
      {booking.payerName && <span className="admin-payer">Paid by: {booking.payerName}</span>}
    </div>
    <div className="admin-booking-body">
      <dl className="admin-details">
        <dt>Contact</dt><dd>{booking.contact}</dd>
        <dt>Email</dt><dd><a href={`mailto:${booking.email}`}>{booking.email}</a></dd>
        <dt>Organization</dt><dd>{booking.organization ?? '–'}</dd>
        <dt>Notes</dt><dd>{booking.notes ?? '–'}</dd>
        <dt>Food allergies</dt><dd>{booking.foodAllergies ?? '–'}</dd>
        <dt>Seats</dt><dd>{seatsByRow(booking.seatIds).map(line => <span key={line}>{line}</span>)}</dd>
        <dt>Received</dt><dd>{formatTime(booking.createdAt)}</dd>
        {booking.reviewedAt && <><dt>{booking.status === 'approved' ? 'Approved' : 'Rejected'}</dt><dd>{formatTime(booking.reviewedAt)}{booking.reviewNote && <span>{booking.reviewNote}</span>}</dd></>}
      </dl>
      <Screenshot path={booking.screenshotPath} reference={booking.referenceCode} guest={booking.fullName} />
    </div>
    {booking.status === 'pending' && <div className="admin-actions">
      <button className="btn-ghost" type="button" onClick={() => onReview('reject')}>Reject</button>
      <button className="btn-primary" type="button" onClick={() => onReview('approve')}>Approve</button>
    </div>}
  </article>
}
