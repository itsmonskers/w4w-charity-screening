'use client'

import type { AdminBooking, SeatCounts } from '@/lib/admin-api'
import { approvedTotal, waitingFor } from './format'

const plural = (count: number, one: string, many: string) => count === 1 ? one : many

// Home: what needs the admin today. Every button goes to a working list (no dead ends).
export function AdminHome({ bookings, seats }: { bookings: AdminBooking[] | null; seats: SeatCounts | null }) {
  if (!bookings) return <p className="admin-empty" role="status">Loading bookings…</p>

  const pending = bookings.filter(b => b.status === 'pending')
  const confirmed = bookings.filter(b => b.status === 'approved').length
  const notApproved = bookings.filter(b => b.status === 'rejected').length
  // bookings come oldest first, but don't rely on it
  const oldest = pending.reduce<AdminBooking | null>((first, b) => !first || b.createdAt < first.createdAt ? b : first, null)

  return <div className="admin-home">
    {oldest
      ? <section className="admin-card is-attention" aria-labelledby="home-waiting">
        <span className="admin-badge is-gold">Needs attention</span>
        <p className="admin-card-number" id="home-waiting">{pending.length} <span>{plural(pending.length, 'booking needs a payment check', 'bookings need a payment check')}</span></p>
        <p className="admin-card-text">The oldest has been waiting {waitingFor(oldest.createdAt)}.</p>
        <a className="btn-primary" href="#check">Start checking</a>
      </section>
      : <section className="admin-card" aria-label="Waiting for review">
        <span className="admin-badge is-accent">All clear</span>
        <p className="admin-card-text is-large">No bookings are waiting for a check.</p>
      </section>}

    <div className="admin-home-pair">
      <section className="admin-card" aria-labelledby="home-confirmed">
        <span className="admin-badge is-accent">Done</span>
        <p className="admin-card-number is-small" id="home-confirmed">{confirmed} <span>{plural(confirmed, 'booking paid and confirmed', 'bookings paid and confirmed')}</span></p>
        <a className="btn-ghost" href="#confirmed">See confirmed list</a>
      </section>
      <section className="admin-card" aria-labelledby="home-not-approved">
        <span className="admin-badge">For your info</span>
        <p className="admin-card-number is-small" id="home-not-approved">{notApproved} <span>{plural(notApproved, 'booking we couldn’t verify', 'bookings we couldn’t verify')}</span></p>
        <a className="btn-ghost" href="#not-approved">See list</a>
      </section>
    </div>

    <details className="admin-numbers">
      <summary>See the numbers</summary>
      <dl>
        <div><dt>Seats still free</dt><dd>{seats ? `${seats.available} of ${seats.available + seats.reserved + seats.taken}` : '–'}</dd></div>
        <div><dt>Seats on hold (waiting for a payment check)</dt><dd>{seats ? seats.reserved : '–'}</dd></div>
        <div><dt>Money confirmed</dt><dd>{approvedTotal(bookings)}</dd></div>
      </dl>
    </details>
  </div>
}
