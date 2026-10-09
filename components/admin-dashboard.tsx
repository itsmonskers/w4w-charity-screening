'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Download, LogOut, RefreshCw, Search } from 'lucide-react'
import { ADMIN_AVAILABLE, approveBooking, checkIsAdmin, getBookings, getScreenshotUrl, getSeatCounts, onAuthChange, rejectBooking, signIn, signOut, type AdminBooking, type BookingStatus, type SeatCounts } from '@/lib/admin-store'
import { formatPrice } from '@/lib/event-config'

const REFRESH_MS = 30_000
const NO_ACCESS = 'This account doesn’t have admin access.'
const TABS: { status: BookingStatus; label: string }[] = [
  { status: 'pending', label: 'Pending' },
  { status: 'approved', label: 'Approved' },
  { status: 'rejected', label: 'Rejected' },
]

const manilaTime = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })
const manilaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' })
const formatTime = (iso: string) => `${manilaTime.format(new Date(iso))} (Manila)`
const seatLabel = (count: number) => `${count} seat${count === 1 ? '' : 's'}`

// "Row L · Seats 7, 8, 9", one line per row, rows and seats ascending (same format as the e-ticket)
function seatsByRow(seats: string[]) {
  const rows = new Map<string, number[]>()
  for (const id of seats) {
    const [row, number] = id.split('-')
    rows.set(row, [...(rows.get(row) ?? []), Number(number)])
  }
  return [...rows].sort(([a], [b]) => a.localeCompare(b)).map(([row, numbers]) => {
    numbers.sort((a, b) => a - b)
    return `Row ${row} · Seat${numbers.length === 1 ? '' : 's'} ${numbers.join(', ')}`
  })
}

function approvedTotal(bookings: AdminBooking[]) {
  const approved = bookings.filter(b => b.status === 'approved')
  const unpriced = approved.filter(b => b.amount === null).length
  if (approved.length && unpriced === approved.length) return formatPrice(null)
  const sum = approved.reduce((total, b) => total + (b.amount ?? 0), 0)
  return unpriced ? `${formatPrice(sum)} + ${unpriced} at [PRICE TBD]` : formatPrice(sum)
}

// Quote every cell; neutralise spreadsheet formulas but keep phone numbers like +63 917 … as they are.
function csvCell(value: string) {
  const formula = /^[=@\t\r]/.test(value) || (/^[+-]/.test(value) && !/^[+-][\d\s()-]*$/.test(value))
  return `"${(formula ? `'${value}` : value).replace(/"/g, '""')}"`
}

function exportApproved(bookings: AdminBooking[]) {
  const header = ['Reference code', 'Name', 'Contact', 'Email', 'Seats', 'Seat count', 'Amount']
  const rows = bookings
    .filter(b => b.status === 'approved')
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map(b => [b.referenceCode, b.fullName, b.contact, b.email, seatsByRow(b.seatIds).join('; '), String(b.seatCount), b.amount === null ? '[PRICE TBD]' : String(b.amount)])
  // BOM so Excel reads ₱ and · correctly
  const csv = '﻿' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `w4w-doomsday-approved-${manilaDate.format(new Date())}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
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
      <p className="eyebrow-caps">Doomsday Charity Screening</p>
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

type Review = { kind: 'approve' | 'reject'; booking: AdminBooking }
type Notice = { message: string; error?: boolean }

function Dashboard({ email, onNoAccess }: { email: string; onNoAccess: () => void }) {
  const [bookings, setBookings] = useState<AdminBooking[] | null>(null)
  const [seats, setSeats] = useState<SeatCounts | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [tab, setTab] = useState<BookingStatus>('pending')
  const [query, setQuery] = useState('')
  const [review, setReview] = useState<Review | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [seatCounts, rows] = await Promise.all([getSeatCounts(), getBookings()])
      setSeats(seatCounts)
      setBookings(rows)
      setUpdatedAt(manilaTime.format(new Date()))
      setLoadError('')
    } catch {
      setLoadError('Couldn’t load the latest data. Check your connection; it retries every 30 seconds.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(timer)
  }, [refresh])

  const q = query.trim().toLowerCase()
  const matches = useMemo(() => (bookings ?? []).filter(b => !q || [b.referenceCode, b.fullName, b.email].some(value => value.toLowerCase().includes(q))), [bookings, q])
  const counts = (status: BookingStatus) => matches.filter(b => b.status === status).length
  const visible = matches
    .filter(b => b.status === tab)
    .sort((a, b) => tab === 'pending' ? a.createdAt.localeCompare(b.createdAt) : (b.reviewedAt ?? b.createdAt).localeCompare(a.reviewedAt ?? a.createdAt))
  const approvedCount = (bookings ?? []).filter(b => b.status === 'approved').length

  function finishReview(next: Notice) {
    setReview(null)
    setNotice(next)
    refresh()
  }

  return <div className="container container-wide">
    <header className="admin-header">
      <div>
        <p className="eyebrow-caps">Doomsday Charity Screening · Admin</p>
        <h1>Payment verification</h1>
      </div>
      <div className="admin-account">
        <span>{email}</span>
        <button className="btn-ghost admin-btn-small" type="button" onClick={() => signOut()}><LogOut size={14} aria-hidden />Sign out</button>
      </div>
    </header>

    <section className="admin-summary" aria-label="Summary">
      <Stat label="Seats available" value={seats?.available} />
      <Stat label="Seats reserved" value={seats?.reserved} />
      <Stat label="Seats taken" value={seats?.taken} />
      <Stat label="Pending bookings" value={bookings?.filter(b => b.status === 'pending').length} />
      <Stat label="Approved total" value={bookings ? approvedTotal(bookings) : undefined} />
    </section>

    <div className="admin-toolbar">
      <label className="admin-search">
        <Search size={16} aria-hidden />
        <span className="sr-only">Search bookings</span>
        <input className="input" type="search" placeholder="Search reference, name or email" value={query} onChange={e => setQuery(e.target.value)} />
      </label>
      <button className="btn-ghost admin-btn-small" type="button" onClick={refresh} disabled={loading}><RefreshCw size={14} aria-hidden />{loading ? 'Refreshing…' : 'Refresh'}</button>
      <button className="btn-ghost admin-btn-small" type="button" onClick={() => bookings && exportApproved(bookings)} disabled={!approvedCount}><Download size={14} aria-hidden />Export approved (CSV)</button>
    </div>
    <p className="admin-updated">{updatedAt ? `Updated ${updatedAt} · refreshes every 30 seconds` : 'Loading…'}</p>

    {loadError && <p className="admin-notice is-error" role="alert">{loadError}</p>}
    {notice && <p className={`admin-notice${notice.error ? ' is-error' : ''}`} role="status">{notice.message}</p>}

    <div className="admin-tabs" role="tablist" aria-label="Booking status">
      {TABS.map(({ status, label }) => <button key={status} className="admin-tab" type="button" role="tab" id={`tab-${status}`} aria-selected={tab === status} aria-controls="admin-list" onClick={() => setTab(status)}>{label} <b>{counts(status)}</b></button>)}
    </div>

    <div className="admin-list" id="admin-list" role="tabpanel" aria-labelledby={`tab-${tab}`}>
      {bookings && !visible.length && <p className="admin-empty">{q ? 'No bookings match your search.' : `No ${tab} bookings.`}</p>}
      {visible.map(booking => <BookingCard key={booking.id} booking={booking} onReview={kind => { setNotice(null); setReview({ kind, booking }) }} />)}
    </div>

    {review && <ReviewDialog key={review.booking.id + review.kind} review={review} onClose={() => setReview(null)} onDone={finishReview} onNoAccess={onNoAccess} />}
  </div>
}

function Stat({ label, value }: { label: string; value: number | string | undefined }) {
  return <div className="admin-stat"><span>{label}</span><strong>{value ?? '–'}</strong></div>
}

function BookingCard({ booking, onReview }: { booking: AdminBooking; onReview: (kind: Review['kind']) => void }) {
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
    <div className="admin-booking-body">
      <dl className="admin-details">
        <dt>Contact</dt><dd>{booking.contact}</dd>
        <dt>Email</dt><dd><a href={`mailto:${booking.email}`}>{booking.email}</a></dd>
        <dt>Organization</dt><dd>{booking.organization ?? '–'}</dd>
        <dt>Notes</dt><dd>{booking.notes ?? '–'}</dd>
        <dt>Seats</dt><dd>{seatsByRow(booking.seatIds).map(line => <span key={line}>{line}</span>)}</dd>
        <dt>Received</dt><dd>{formatTime(booking.createdAt)}</dd>
        {booking.reviewedAt && <><dt>{booking.status === 'approved' ? 'Approved' : 'Rejected'}</dt><dd>{formatTime(booking.reviewedAt)}{booking.reviewNote && <span>{booking.reviewNote}</span>}</dd></>}
      </dl>
      <Screenshot path={booking.screenshotPath} reference={booking.referenceCode} />
    </div>
    {booking.status === 'pending' && <div className="admin-actions">
      <button className="btn-ghost" type="button" onClick={() => onReview('reject')}>Reject</button>
      <button className="btn-primary" type="button" onClick={() => onReview('approve')}>Approve</button>
    </div>}
  </article>
}

function Screenshot({ path, reference }: { path: string; reference: string }) {
  // HEIC/HEIF won't preview in most browsers: offer a download instead
  const [download, setDownload] = useState(/\.(heic|heif)$/i.test(path))
  const [url, setUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    getScreenshotUrl(path, download).then(signed => { if (!cancelled) signed ? setUrl(signed) : setMissing(true) }, () => { if (!cancelled) setMissing(true) })
    return () => { cancelled = true }
  }, [path, download])

  if (missing) return <p className="admin-shot-note">Couldn’t load the payment screenshot. Refresh to try again.</p>
  if (!url) return <div className="admin-shot is-loading">Loading screenshot…</div>
  if (download) return <div className="admin-shot-note">
    <span>This screenshot can’t be previewed here.</span>
    <a className="btn-ghost admin-btn-small" href={url} download><Download size={14} aria-hidden />Download screenshot</a>
  </div>
  return <a className="admin-shot" href={url} target="_blank" rel="noopener noreferrer" title="Open full size">
    <img src={url} alt={`Payment screenshot for ${reference}, opens full size`} onError={() => { setUrl(null); setDownload(true) }} />
  </a>
}

function ReviewDialog({ review, onClose, onDone, onNoAccess }: { review: Review; onClose: () => void; onDone: (notice: Notice) => void; onNoAccess: () => void }) {
  const { kind, booking } = review
  const approving = kind === 'approve'
  const ref = useRef<HTMLDialogElement>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { ref.current?.showModal() }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!approving && !note.trim()) { setError('Enter a reason for rejecting.'); return }
    setBusy(true)
    setError('')
    const result = await (approving ? approveBooking : rejectBooking)(booking.id, note)
    setBusy(false)
    if (result.ok) return onDone({ message: approving ? `Approved ${booking.referenceCode}. Its seats are now taken.` : `Rejected ${booking.referenceCode}. Its seats are available again.` })
    if (result.error === 'booking_not_pending') return onDone({ message: `Someone else already handled ${booking.referenceCode}. The list has been refreshed.`, error: true })
    if (result.error === 'booking_not_found') return onDone({ message: `${booking.referenceCode} no longer exists. The list has been refreshed.`, error: true })
    if (result.error === 'not_admin') return onNoAccess()
    setError('Couldn’t save this. Check your connection and try again.')
  }

  return <dialog ref={ref} className="admin-dialog" aria-labelledby="review-title" onClose={onClose} onCancel={event => { if (busy) event.preventDefault() }}>
    <form onSubmit={submit}>
      <div>
        <p className="eyebrow-caps">{booking.referenceCode}</p>
        <h2 id="review-title">{approving ? 'Approve booking' : 'Reject booking'}</h2>
      </div>
      <p className="admin-dialog-name">{booking.fullName}</p>
      <div className="admin-dialog-amount">
        <span>Amount</span>
        <strong>{formatPrice(booking.amount)}</strong>
      </div>
      <div className="admin-dialog-seats">
        {seatsByRow(booking.seatIds).map(line => <span key={line}>{line}</span>)}
        <span>{seatLabel(booking.seatCount)}</span>
      </div>
      {approving
        ? <p className="admin-warning">Only approve after confirming this exact amount arrived in the account.</p>
        : <p className="admin-warning">Rejecting frees these seats immediately, so anyone can book them again.</p>}
      <div className="field">
        <label className="field-label" htmlFor="review-note">{approving ? 'Note (optional)' : 'Reason (required)'}</label>
        <textarea className="input" id="review-note" rows={3} maxLength={500} value={note} onChange={e => setNote(e.target.value)} aria-invalid={!!error && !approving && !note.trim()} aria-describedby={error ? 'review-error' : undefined} />
      </div>
      {error && <p className="field-error" id="review-error" role="alert">{error}</p>}
      <div className="admin-dialog-actions">
        <button className="btn-ghost" type="button" onClick={() => ref.current?.close()} disabled={busy}>Cancel</button>
        <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : approving ? 'Approve' : 'Reject'}</button>
      </div>
    </form>
  </dialog>
}
