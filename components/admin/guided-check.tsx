'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import type { AdminBooking } from '@/lib/admin-api'
import { formatPrice } from '@/lib/event-config'
import { CopyButton } from './copy-button'
import { formatTime, seatLabel, seatsByRow, waitingFor } from './format'
import { Screenshot } from './screenshot'

type Props = {
  bookings: AdminBooking[] | null
  onAnswer: (kind: 'approve' | 'reject', booking: AdminBooking) => void
}

// One waiting booking at a time, oldest first. The queue is a snapshot: bookings that
// arrive later join the end, and the booking on screen is never swapped out by a refresh.
export function GuidedCheck({ bookings, onAnswer }: Props) {
  const [queue, setQueue] = useState<string[] | null>(null)
  const [index, setIndex] = useState(0)
  // Last copy of every booking in the queue, in case one disappears from the data
  const known = useRef(new Map<string, AdminBooking>())
  const name = useRef<HTMLHeadingElement>(null)
  const firstShown = useRef(true)

  useEffect(() => {
    if (!bookings) return
    bookings.forEach(b => known.current.set(b.id, b))
    const waiting = bookings.filter(b => b.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(b => b.id)
    setQueue(current => {
      if (!current) return waiting
      const added = waiting.filter(id => !current.includes(id))
      return added.length ? [...current, ...added] : current
    })
  }, [bookings])

  const currentId = queue?.[index]
  // When moving on to another booking: back to the top, focus on the guest's name
  useEffect(() => {
    if (!currentId) return
    if (firstShown.current) { firstShown.current = false; return }
    window.scrollTo(0, 0)
    name.current?.focus()
  }, [currentId])

  if (!bookings || !queue) return <p className="admin-empty" role="status">Loading bookings…</p>

  const next = () => setIndex(i => i + 1)
  const total = queue.length
  const top = <div className="admin-check-top">
    <a className="admin-back" href="#home"><ArrowLeft size={18} aria-hidden />Back to Home</a>
    {currentId && <div className="admin-progress-wrap">
      <p className="admin-progress-text">Booking {index + 1} of {total}</p>
      <div className="admin-progress" aria-hidden><span style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
    </div>}
  </div>
  const allWaiting = <a className="admin-text-link" href="#waiting">See all waiting bookings</a>

  if (!currentId) {
    const stillWaiting = bookings.filter(b => b.status === 'pending').length
    return <div className="admin-check-wrap">
      {top}
      <section className="admin-card">
        <span className="admin-badge is-accent">{total ? 'End of the list' : 'All clear'}</span>
        <p className="admin-card-text is-large">{total ? 'You’ve gone through every booking that was waiting.' : 'No bookings are waiting for a check.'}</p>
        {stillWaiting > 0 && <p className="admin-card-text">{stillWaiting === 1 ? '1 booking is' : `${stillWaiting} bookings are`} still waiting (skipped or not finished).</p>}
        <a className="btn-primary" href="#home">Back to Home</a>
      </section>
      {stillWaiting > 0 && allWaiting}
    </div>
  }

  const booking = bookings.find(b => b.id === currentId) ?? known.current.get(currentId)!
  const handled = booking.status !== 'pending'

  return <div className="admin-check-wrap">
    {top}
    <article className="admin-check" aria-labelledby="check-guest">
      <header>
        <h2 className="admin-check-name" id="check-guest" ref={name} tabIndex={-1}>{booking.fullName}</h2>
        <p className="admin-check-meta">{seatLabel(booking.seatCount)} · booked {waitingFor(booking.createdAt)} ago</p>
      </header>

      <div className="admin-check-body">
        <Screenshot key={booking.id} path={booking.screenshotPath} reference={booking.referenceCode} guest={booking.fullName} large />

        <div className="admin-check-side">
          <section className="admin-find" aria-labelledby="find-title">
            <p className="admin-find-title" id="find-title">Open the UnionBank app and look for this payment:</p>
            <dl className="admin-find-list">
              <div><dt>Amount</dt><dd className="admin-find-amount">{formatPrice(booking.amount)}</dd></div>
              <div><dt>Reference</dt><dd><span className="admin-find-ref">{booking.paymentRef ?? '–'}</span>{booking.paymentRef && <CopyButton text={booking.paymentRef} label="payment reference" />}</dd></div>
              <div><dt>From</dt><dd>{booking.payerName ?? booking.fullName}{!booking.payerName && <span className="admin-find-hint">No payer name given, so this is the guest’s name.</span>}</dd></div>
            </dl>
          </section>

          {handled
            ? <div className="admin-handled" role="status">
              <p>This booking is no longer waiting: it’s now <strong>{booking.status === 'approved' ? 'confirmed' : 'not approved'}</strong>.</p>
              <button className="btn-primary" type="button" onClick={next}>Next booking</button>
            </div>
            : <div className="admin-answer">
              <p className="admin-question">Did you find this payment?</p>
              <div className="admin-answer-buttons">
                <button className="btn-primary" type="button" onClick={() => onAnswer('approve', booking)}><Check size={18} aria-hidden />Yes, I found it</button>
                <button className="btn-ghost" type="button" onClick={() => onAnswer('reject', booking)}>No, something’s wrong</button>
              </div>
              <button className="admin-text-link" type="button" onClick={next}>Not sure yet? Skip for now</button>
            </div>}
        </div>
      </div>

      <details className="admin-more">
        <summary>More details about this guest</summary>
        <dl className="admin-details">
          <dt>Seats</dt><dd>{seatsByRow(booking.seatIds).map(line => <span key={line}>{line}</span>)}</dd>
          <dt>Mobile</dt><dd>{booking.contact}</dd>
          <dt>Email</dt><dd>{booking.email}</dd>
          <dt>Organization</dt><dd>{booking.organization ?? '–'}</dd>
          <dt>Food allergies</dt><dd>{booking.foodAllergies ?? '–'}</dd>
          <dt>Notes</dt><dd>{booking.notes ?? '–'}</dd>
          <dt>Booking code</dt><dd>{booking.referenceCode}</dd>
          <dt>Received</dt><dd>{formatTime(booking.createdAt)}</dd>
        </dl>
      </details>
    </article>
    {allWaiting}
  </div>
}
