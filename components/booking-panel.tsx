'use client'

import { useEffect, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type RefObject, type SetStateAction } from 'react'
import { Check, Copy, Download, Upload, X } from 'lucide-react'
import { reserveSeats, type ReserveError, type ReserveInput, type Settings } from '@/lib/booking-store'
import { EVENT, formatPrice } from '@/lib/event-config'

export const EVENT_DATE_SHORT = 'Sat, Dec 19, 2026'
export const EVENT_PLACE = `Cinema 7, ${EVENT.venue}`
export const seatsTotal = (price: number | null, count: number) => formatPrice(price === null ? null : price * count)

const MAX_FILE_BYTES = 10 * 1024 * 1024
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp']
const FIELD_ORDER = ['seats', 'fullName', 'contact', 'email', 'proof', 'consent'] as const
const emptyForm = { fullName: '', contact: '', email: '', company: '', notes: '' }

type Form = typeof emptyForm
type Errors = Partial<Record<(typeof FIELD_ORDER)[number], string>>
type Booking = { reference: string; seats: string[]; email: string; amount: number | null }

const ERROR_MESSAGES: Record<ReserveError, string> = {
  bookings_closed: 'Bookings are closed, so we couldn’t reserve your seats.',
  invalid_seat_count: 'That number of seats can’t be booked. Please change your selection and try again.',
  invalid_seats: 'Some of the selected seats don’t exist. Please refresh the page and choose again.',
  missing_details: 'Please check your name, contact and email. Each is required, and notes must be under 1,000 characters.',
  invalid_email: 'That email address doesn’t look right. Please check it and try again.',
  missing_screenshot: 'We couldn’t find your payment screenshot. Please upload it again and retry.',
  upload_failed: 'Couldn’t upload your screenshot, please try again.',
  unknown: 'Something went wrong and your seats were not reserved. Please try again.',
}

function validate(selected: string[], form: Form, file: File | null, consent: boolean) {
  const errors: Errors = {}
  if (!selected.length) errors.seats = 'Pick at least one seat on the map.'
  if (!form.fullName.trim()) errors.fullName = 'Enter your full name.'
  if (!form.contact.trim()) errors.contact = 'Enter your mobile number or Messenger name.'
  if (!form.email.trim()) errors.email = 'Enter your email address.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address, like name@example.com.'
  if (!file) errors.proof = 'Upload a screenshot of your payment.'
  else if (!FILE_TYPES.includes(file.type) && !/\.(jpe?g|png|heic|webp)$/i.test(file.name)) errors.proof = 'Use a JPG, PNG, HEIC or WEBP image.'
  else if (file.size > MAX_FILE_BYTES) errors.proof = 'This file is over 10 MB. Please upload a smaller screenshot.'
  if (!consent) errors.consent = 'Tick the box to agree before reserving.'
  return errors
}

// "Row L · Seats 7, 8, 9", one line per row, rows and seats ascending
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

const describedBy = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(' ') || undefined

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return <div className="field">
    <label className="field-label" htmlFor={id}>{label}</label>
    {children}
    {hint && <small className="field-hint" id={`${id}-hint`}>{hint}</small>}
    {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
  </div>
}

type Props = {
  settings: Settings | null
  selected: string[]
  onSelectedChange: Dispatch<SetStateAction<string[]>>
  onSubmittingChange: (submitting: boolean) => void
  onBookedChange: (booked: boolean) => void
  onReserveMore: () => void
  sheetOpen: boolean
  onSheetOpenChange: Dispatch<SetStateAction<boolean>>
}

export function BookingPanel({ settings, selected, onSelectedChange, onSubmittingChange, onBookedChange, onReserveMore, sheetOpen, onSheetOpenChange }: Props) {
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState<File | null>(null)
  const [consent, setConsent] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [booking, setBooking] = useState<Booking | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const ticketHeadingRef = useRef<HTMLHeadingElement>(null)

  const errors = validate(selected, form, file, consent)
  const shown: Errors = showErrors ? errors : {}
  const errorCount = Object.keys(errors).length
  const update = (key: keyof Form, value: string) => setForm(current => ({ ...current, [key]: value }))
  const invalid = (key: keyof Errors) => shown[key] ? { 'aria-invalid': true as const } : {}

  // Mobile bottom sheet: focus trapped, Esc closes, focus returns to the opener
  useEffect(() => {
    if (!sheetOpen) return
    const panel = panelRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const desktop = window.matchMedia('(min-width: 1024px)')
    closeRef.current?.focus()
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return onSheetOpenChange(false)
      if (event.key !== 'Tab' || !panel) return
      const focusable = [...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (!first) return
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    const onMediaChange = () => { if (desktop.matches) onSheetOpenChange(false) }
    document.addEventListener('keydown', onKeyDown)
    desktop.addEventListener('change', onMediaChange)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      desktop.removeEventListener('change', onMediaChange)
      document.body.style.overflow = ''
      opener?.focus()
    }
  }, [sheetOpen, onSheetOpenChange])

  useEffect(() => { if (booking) ticketHeadingRef.current?.focus() }, [booking])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (loading) return
    setSubmitError('')
    if (!file || errorCount) {
      setShowErrors(true)
      const first = FIELD_ORDER.find(key => errors[key])
      document.getElementById(`bk-${first}`)?.focus()
      return
    }
    setLoading(true)
    onSubmittingChange(true)
    const input: ReserveInput = { ...form, seats: selected, proof: file }
    const response = await reserveSeats(input)
    setLoading(false)
    onSubmittingChange(false)
    if (!response.ok) {
      if ('error' in response) return setSubmitError(ERROR_MESSAGES[response.error])
      onSelectedChange(current => current.filter(id => !response.conflicts.includes(id)))
      setSubmitError(`These seats were taken: ${response.conflicts.join(', ')}. Please choose again.`)
      return
    }
    setShowErrors(false)
    setBooking({ reference: response.referenceCode, seats: response.seats, email: form.email, amount: response.amount })
    onBookedChange(true)
    onSelectedChange([])
  }

  const reserveMore = () => {
    setBooking(null)
    setFile(null)
    setConsent(false)
    onBookedChange(false)
    onSelectedChange([])
    onReserveMore()
  }

  return <aside
    ref={panelRef}
    id="booking-panel"
    className={`booking-panel${sheetOpen ? ' is-open' : ''}${booking ? ' is-success' : ''}`}
    aria-label="Your booking"
    role={sheetOpen ? 'dialog' : undefined}
    aria-modal={sheetOpen || undefined}
  >
    <div className="sheet-bar">
      <p className="eyebrow-caps">Your booking</p>
      <button ref={closeRef} type="button" className="sheet-close" aria-label="Close booking" onClick={() => onSheetOpenChange(false)}><X /></button>
    </div>
    <div className="panel-body">
      {booking ? <Ticket booking={booking} headingRef={ticketHeadingRef} onReserveMore={reserveMore} /> : <form className="booking-form" noValidate onSubmit={submit}>
        <section className="panel-section" aria-labelledby="bk-seats-title">
          <div className="panel-heading"><h2 id="bk-seats-title" className="eyebrow-caps panel-title">Your seats</h2><span>{selected.length} of {settings?.maxSeats ?? '…'}</span></div>
          <div id="bk-seats" className="chips" tabIndex={-1} aria-describedby={describedBy(shown.seats && 'bk-seats-error')}>
            {selected.length ? selected.map(id => <span className="chip" key={id}>{id}<button type="button" aria-label={`Remove seat ${id}`} onClick={() => onSelectedChange(current => current.filter(seat => seat !== id))}><X /></button></span>) : <p className="panel-empty">No seats selected · Tap a glowing seat to start</p>}
          </div>
          <div className="amount-row"><span>{selected.length} seat{selected.length === 1 ? '' : 's'}</span><span>Amount due <strong>{seatsTotal(settings?.pricePerSeat ?? null, selected.length)}</strong></span></div>
          {shown.seats && <p className="field-error" id="bk-seats-error">{shown.seats}</p>}
        </section>

        <Field id="bk-fullName" label="Full name*" error={shown.fullName}>
          <input id="bk-fullName" className="input" autoComplete="name" value={form.fullName} onChange={e => update('fullName', e.target.value)} {...invalid('fullName')} aria-describedby={describedBy(shown.fullName && 'bk-fullName-error')} />
        </Field>
        <Field id="bk-contact" label="Mobile number or Messenger name*" error={shown.contact}>
          <input id="bk-contact" className="input" autoComplete="tel" value={form.contact} onChange={e => update('contact', e.target.value)} {...invalid('contact')} aria-describedby={describedBy(shown.contact && 'bk-contact-error')} />
        </Field>
        <Field id="bk-email" label="Email*" hint="Your e-tickets are sent here" error={shown.email}>
          <input id="bk-email" className="input" type="email" autoComplete="email" value={form.email} onChange={e => update('email', e.target.value)} {...invalid('email')} aria-describedby={describedBy('bk-email-hint', shown.email && 'bk-email-error')} />
        </Field>
        <Field id="bk-company" label="Company / organization (optional)">
          <input id="bk-company" className="input" autoComplete="organization" value={form.company} onChange={e => update('company', e.target.value)} />
        </Field>

        <section className="pay-box" aria-labelledby="bk-pay-title">
          <h2 id="bk-pay-title" className="eyebrow-caps panel-title">How to pay</h2>
          <p>Send your payment, then attach the screenshot below.</p>
          <div className="qr-placeholder">[PAYMENT QR TBD]</div>
          <button type="button" className="btn-ghost" disabled aria-disabled="true"><Download /> Save QR code</button>
          <p className="pay-note">Paying from this phone? Save the QR, then in GCash, Maya or your bank app choose Pay via QR and upload it from your gallery.</p>
        </section>

        <div className="field">
          <span className="field-label" id="bk-proof-label">Payment screenshot*</span>
          <label className="upload">
            <Upload />
            <span>{file ? file.name : 'Upload payment screenshot'}</span>
            <small>JPG, PNG, HEIC or WEBP · 10 MB max</small>
            <input id="bk-proof" className="sr-only" type="file" accept="image/jpeg,image/png,image/heic,image/webp,.heic" aria-labelledby="bk-proof-label" {...invalid('proof')} aria-describedby={describedBy(shown.proof && 'bk-proof-error')} onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {shown.proof && <p className="field-error" id="bk-proof-error">{shown.proof}</p>}
        </div>

        <Field id="bk-notes" label="Notes (optional)">
          <textarea id="bk-notes" className="input" rows={3} value={form.notes} onChange={e => update('notes', e.target.value)} />
        </Field>

        <div className="field">
          <label className="consent"><input id="bk-consent" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} {...invalid('consent')} aria-describedby={describedBy(shown.consent && 'bk-consent-error')} />I agree to Waves for Water Philippines processing my details for this booking, per the Data Privacy Act of 2012.</label>
          {shown.consent && <p className="field-error" id="bk-consent-error">{shown.consent}</p>}
        </div>

        {settings?.bookingsOpen === false && <p className="info-notice" role="status">Bookings are closed</p>}
        <button type="submit" className="btn-primary full" disabled={loading || !settings?.bookingsOpen}>{loading ? 'Reserving…' : 'Reserve seats'} <Check /></button>
        {showErrors && errorCount > 0 && <p className="field-error" role="alert">Please check the {errorCount === 1 ? 'highlighted field' : `${errorCount} highlighted fields`} above.</p>}
        {submitError && <p className="field-error" role="alert">{submitError}</p>}
      </form>}
    </div>
  </aside>
}

function Ticket({ booking, headingRef, onReserveMore }: { booking: Booking; headingRef: RefObject<HTMLHeadingElement | null>; onReserveMore: () => void }) {
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    if (copy === 'idle') return
    const timer = window.setTimeout(() => setCopy('idle'), 2000)
    return () => window.clearTimeout(timer)
  }, [copy])
  const copyReference = () => navigator.clipboard.writeText(booking.reference).then(() => setCopy('copied'), () => setCopy('failed'))
  const count = booking.seats.length

  return <div className="ticket">
    <div className="ticket-stub">
      <div className="ticket-status"><p className="eyebrow-caps">Reservation received</p><span className="pill">Pending verification</span></div>
      <h2 className="ticket-title" ref={headingRef} tabIndex={-1}>You&apos;re in.</h2>
      <div className="ticket-lines">
        <strong>{EVENT.film} · Charity screening</strong>
        <span>{EVENT_DATE_SHORT}</span>
        <span>{EVENT.time}</span>
        <span>{EVENT_PLACE}</span>
      </div>
      <div className="ticket-lines">
        {seatsByRow(booking.seats).map(line => <span key={line}>{line}</span>)}
        <strong>{count} ticket{count === 1 ? '' : 's'} · Total {formatPrice(booking.amount)}</strong>
      </div>
    </div>
    <div className="ticket-perforation" aria-hidden="true" />
    <div className="ticket-stub">
      <small className="ticket-label">Reference code</small>
      <div className="ticket-reference">
        <span>{booking.reference}</span>
        <button type="button" className="copy-button" onClick={copyReference}>{copy === 'copied' ? <><Check /> Copied</> : copy === 'failed' ? 'Copy failed' : <><Copy /> Copy</>}</button>
        <span className="sr-only" aria-live="polite">{copy === 'copied' ? 'Reference code copied' : ''}</span>
      </div>
      <p className="ticket-message">We received your payment screenshot. Once we verify it, your e-tickets (one per seat, each with a QR code) will be emailed to <strong>{booking.email}</strong>. Keep your reference code.</p>
      <button type="button" className="btn-ghost" onClick={onReserveMore}>Reserve more seats</button>
    </div>
  </div>
}
