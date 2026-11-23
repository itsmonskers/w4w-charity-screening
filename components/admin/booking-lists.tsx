'use client'

import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { AdminBooking } from '@/lib/admin-api'
import { formatPrice } from '@/lib/event-config'
import { formatTime, manilaDay, matchesSearch, seatLabel, seatsByRow } from './format'
import { Screenshot } from './screenshot'

export function StatusBadge({ status }: { status: AdminBooking['status'] }) {
  if (status === 'approved') return <span className="admin-badge is-accent admin-badge-icon"><Check size={14} aria-hidden />Confirmed</span>
  if (status === 'rejected') return <span className="admin-badge">Not approved</span>
  return <span className="admin-badge is-gold">Waiting</span>
}

// Confirmed / Not approved: simple rows, newest decision first. Tapping a row opens its
// details (read-only, with the payment screenshot) right under it.
export function BookingList({ bookings, status, query }: { bookings: AdminBooking[] | null; status: 'approved' | 'rejected'; query: string }) {
  const [open, setOpen] = useState<string | null>(null)
  if (!bookings) return <p className="admin-empty" role="status">Loading bookings…</p>

  const all = bookings.filter(b => b.status === status)
  const rows = all.filter(b => matchesSearch(b, query)).sort((a, b) => (b.reviewedAt ?? b.createdAt).localeCompare(a.reviewedAt ?? a.createdAt))
  const decided = status === 'approved' ? 'Confirmed' : 'Marked not approved'

  if (!all.length) return <p className="admin-empty">{status === 'approved' ? 'No confirmed bookings yet.' : 'No bookings have been marked not approved.'}</p>
  if (!rows.length) return <p className="admin-empty">No bookings match your search.</p>

  return <ul className="admin-rows">
    {rows.map(b => {
      const expanded = open === b.id
      return <li key={b.id} className="admin-row">
        <button className="admin-row-button" type="button" aria-expanded={expanded} aria-controls={`row-${b.id}`} onClick={() => setOpen(expanded ? null : b.id)}>
          <span className="admin-row-main">
            <span className="admin-row-name">{b.fullName}</span>
            <span className="admin-row-meta">{formatPrice(b.amount)} · {seatLabel(b.seatCount)} · {manilaDay(b.reviewedAt ?? b.createdAt)}</span>
          </span>
          <StatusBadge status={b.status} />
          <ChevronDown className="admin-row-chevron" size={20} aria-hidden />
        </button>
        {expanded && <div className="admin-row-detail" id={`row-${b.id}`}>
          <dl className="admin-details">
            <dt>{decided}</dt><dd>{b.reviewedAt ? formatTime(b.reviewedAt) : '–'}</dd>
            {b.reviewNote && <><dt>Team note</dt><dd>{b.reviewNote}</dd></>}
            <dt>Seats</dt><dd>{seatsByRow(b.seatIds).map(line => <span key={line}>{line}</span>)}</dd>
            <dt>Amount</dt><dd>{formatPrice(b.amount)}</dd>
            <dt>Payment ref</dt><dd>{b.paymentRef ?? '–'}</dd>
            <dt>Paid by</dt><dd>{b.payerName ?? '–'}</dd>
            <dt>Mobile</dt><dd>{b.contact}</dd>
            <dt>Email</dt><dd>{b.email}</dd>
            <dt>Organization</dt><dd>{b.organization ?? '–'}</dd>
            <dt>Food allergies</dt><dd>{b.foodAllergies ?? '–'}</dd>
            <dt>Notes</dt><dd>{b.notes ?? '–'}</dd>
            <dt>Booking code</dt><dd>{b.referenceCode}</dd>
            <dt>Received</dt><dd>{formatTime(b.createdAt)}</dd>
          </dl>
          <Screenshot path={b.screenshotPath} reference={b.referenceCode} guest={b.fullName} />
        </div>}
      </li>
    })}
  </ul>
}
