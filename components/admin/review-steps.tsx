'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft } from 'lucide-react'
import { approveBooking, rejectBooking, type AdminBooking } from '@/lib/admin-api'
import { formatPrice } from '@/lib/event-config'
import { seatLabel, seatsByRow } from './format'

export type StepKind = 'approve' | 'reject'
// What happened, for the screen that opened the step to decide what comes next
export type StepOutcome = { kind: 'done'; action: StepKind; emailSent: boolean } | { kind: 'handled' } | { kind: 'missing' }

export const REASONS = ['I can’t find the payment', 'The amount is different', 'The receipt looks wrong', 'Something else'] as const
const MAX_NOTE = 500 // same limit as before
const reviewNote = (reason: string, note: string) => `Reason: ${reason}.${note.trim() ? ` Note: ${note.trim()}` : ''}`.slice(0, MAX_NOTE)
// Leave room for the longest "Reason: …. Note: " so the saved note never passes 500
const NOTE_ROOM = MAX_NOTE - reviewNote(REASONS.reduce((a, b) => a.length >= b.length ? a : b), 'x').length + 1

export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0]

// The message shown after a step finishes (same facts as the old pop-up's messages)
export function outcomeNotice(outcome: StepOutcome, booking: AdminBooking): { message: string; error?: boolean } {
  const name = firstName(booking.fullName)
  if (outcome.kind === 'handled') return { message: `Someone else already handled ${booking.fullName}’s booking, so nothing was changed.`, error: true }
  if (outcome.kind === 'missing') return { message: `${booking.fullName}’s booking (${booking.referenceCode}) no longer exists. Nothing was changed.`, error: true }
  const done = outcome.action === 'approve' ? `Confirmed ${booking.fullName}’s ${seatLabel(booking.seatCount)}.` : `Marked ${booking.fullName} as not approved. The ${seatLabel(booking.seatCount)} are free for others again.`
  if (outcome.emailSent) return { message: `${done} ${name} has been emailed.` }
  return { message: `${done} The email to ${name} did not send: please email ${booking.email} yourself (see docs/email-templates.md).`, error: true }
}

type Props = {
  kind: StepKind
  booking: AdminBooking
  onBack: () => void        // "Go back" (to the booking)
  onSkip: () => void        // "Not sure? Skip and decide later"
  onDone: (outcome: StepOutcome) => void
  onNoAccess: () => void
}

// The confirm step and the not-approved step. Calls the same approve / reject functions,
// with the same arguments, as the old pop-up did.
export function ReviewStep({ kind, booking, onBack, onSkip, onDone, onNoAccess }: Props) {
  const approving = kind === 'approve'
  const name = firstName(booking.fullName)
  const seats = seatLabel(booking.seatCount)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const saving = useRef(false) // blocks a second tap before the screen re-renders
  const title = useRef<HTMLHeadingElement>(null)

  useEffect(() => { title.current?.focus() }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving.current) return
    if (!approving && !reason) { setError('Choose what’s wrong with the payment.'); return }
    saving.current = true
    setBusy(true)
    setError('')
    const result = approving ? await approveBooking(booking.id, '') : await rejectBooking(booking.id, reviewNote(reason, note))
    if (result.ok) return onDone({ kind: 'done', action: kind, emailSent: result.emailSent })
    if (result.error === 'booking_not_pending') return onDone({ kind: 'handled' })
    if (result.error === 'booking_not_found') return onDone({ kind: 'missing' })
    if (result.error === 'not_admin') return onNoAccess()
    saving.current = false
    setBusy(false)
    setError('Couldn’t save this. Check your connection and try again.')
  }

  const summary = <dl className="admin-step-summary">
    <div><dt>Amount</dt><dd>{formatPrice(booking.amount)}</dd></div>
    <div><dt>Reference</dt><dd className="admin-find-ref">{booking.paymentRef ?? '–'}</dd></div>
    <div><dt>Seats</dt><dd>{seatsByRow(booking.seatIds).map(line => <span key={line}>{line}</span>)}</dd></div>
  </dl>
  const status = busy && <p className="admin-step-saving" role="status">Saving… don’t close this page</p>
  const failed = error && <p className="field-error admin-step-error" role="alert" id="step-error">{error}</p>

  return <form className="admin-step" onSubmit={submit} aria-labelledby="step-title" noValidate>
    <button className="admin-text-link admin-step-back" type="button" onClick={onBack} disabled={busy}><ArrowLeft size={18} aria-hidden />Go back</button>

    {approving
      ? <>
        <h2 className="admin-step-title" id="step-title" ref={title} tabIndex={-1}>Great! Confirm {booking.fullName}’s {seats}?</h2>
        <p className="admin-step-text">{name} will get a ‘Booking confirmed’ email right away.</p>
        {summary}
        <p className="admin-warning">This can’t be undone from here.</p>
      </>
      : <>
        <h2 className="admin-step-title" id="step-title" ref={title} tabIndex={-1}>What’s wrong with {name}’s payment?</h2>
        <fieldset className="admin-reasons" aria-describedby={error ? 'step-error' : undefined} aria-invalid={!!error && !reason}>
          <legend className="sr-only">What’s wrong with {name}’s payment? (choose one)</legend>
          {REASONS.map(choice => <label key={choice} className="admin-reason">
            <input type="radio" name="reason" value={choice} checked={reason === choice} onChange={() => { setReason(choice); setError('') }} disabled={busy} />
            <span>{choice}</span>
          </label>)}
        </fieldset>
        <div className="field">
          <label className="field-label" htmlFor="step-note">Note for the team (optional, the guest won’t see it)</label>
          <textarea className="input" id="step-note" rows={3} maxLength={NOTE_ROOM} value={note} onChange={e => setNote(e.target.value)} disabled={busy} aria-describedby="step-note-count" />
          <span className="field-hint" id="step-note-count">{NOTE_ROOM - note.length} characters left</span>
        </div>
        {summary}
        <p className="admin-warning">{name}’s {seats} will be freed for others, and {name} will get an email saying we couldn’t verify the payment. This can’t be undone.</p>
      </>}

    <div className="admin-action-bar">
      {failed}
      {status}
      <div className="admin-action-buttons">
        <button className="btn-primary" type="submit" disabled={busy}>{approving ? `Confirm and email ${name}` : 'Mark as not approved'}</button>
        <button className="btn-ghost" type="button" onClick={approving ? onBack : onSkip} disabled={busy}>{approving ? 'Go back' : 'Not sure? Skip and decide later'}</button>
      </div>
    </div>
  </form>
}
