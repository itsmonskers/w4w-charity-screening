'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, RefreshCw, Send } from 'lucide-react'
import { getQrEmailsToSend, sendCheckInQrEmail, type AdminBooking, type QrEmailBooking, type QrEmailResult } from '@/lib/admin-api'
import { decisionEmail } from '@/lib/admin-email-copy'
import { EMAIL_CC } from '@/lib/email-templates'
import { CopyButton } from './copy-button'
import { seatsByRow } from './format'
import { QrDownloadButton } from './qr-download'

// Tools → "Send check-in QR codes" (#qr-emails). One-time: guests confirmed before the QR was
// added to the "Booking confirmed" email get the separate "Your check-in QR code" email.
// The server marks each one as sent in the same step, so nobody gets it twice, even if two
// admins press Send at once. Asks before sending; sends one at a time.

type RowStatus = 'sending' | QrEmailResult
const emails = (count: number) => `${count} email${count === 1 ? '' : 's'}`

export function SendQrEmails({ bookings }: { bookings: AdminBooking[] | null }) {
  const [list, setList] = useState<QrEmailBooking[] | null>(null)
  const [loadError, setLoadError] = useState<'' | 'not_set_up' | 'failed'>('')
  const [status, setStatus] = useState<Record<string, RowStatus>>({})
  const [step, setStep] = useState<'idle' | 'confirm' | 'sending' | 'finished'>('idle')

  const load = useCallback(async () => {
    setLoadError('')
    setStatus({})
    setStep('idle')
    try {
      setList(await getQrEmailsToSend())
    } catch (error) {
      setList(null)
      setLoadError(error instanceof Error && error.message === 'not_set_up' ? 'not_set_up' : 'failed')
    }
  }, [])
  useEffect(() => { load() }, [load])

  async function send(ids: string[]) {
    setStep('sending')
    for (const id of ids) {
      setStatus(current => ({ ...current, [id]: 'sending' }))
      const result = await sendCheckInQrEmail(id)
      setStatus(current => ({ ...current, [id]: result }))
    }
    setStep('finished')
  }

  if (loadError) return <p className="admin-notice is-error" role="alert">{loadError === 'not_set_up'
    ? 'Check-in isn’t set up in the database yet, so there are no QR codes to send. Please tell the team lead.'
    : 'Couldn’t load the list. Check your connection and try again.'}</p>
  if (!list) return <p className="admin-empty" role="status">Loading…</p>

  const counts = (kind: QrEmailResult) => list.filter(b => status[b.id] === kind).length
  const sending = list.findIndex(b => status[b.id] === 'sending')

  return <div className="admin-qr-emails">
    <p className="admin-lede">Guests confirmed before the check-in QR code was added to the confirmed email get it once, in a separate email: “Your check-in QR code”. Guests confirmed from now on get it automatically.</p>

    {!list.length ? <section className="admin-card" aria-label="All sent">
      <span className="admin-badge is-accent">All clear</span>
      <p className="admin-card-text is-large">Every confirmed guest has their check-in QR code. Nothing to send.</p>
    </section> : <>
      <p className="admin-card-text is-large">{list.length === 1 ? '1 confirmed guest hasn’t' : `${list.length} confirmed guests haven’t`} got their check-in QR code yet.</p>
      <ul className="admin-rows">
        {list.map(b => {
          const row = status[b.id]
          const booking = bookings?.find(x => x.id === b.id)
          const copy = booking && decisionEmail('checkin', booking)
          return <li key={b.id} className="admin-row admin-qr-row">
            <span className="admin-row-main">
              <span className="admin-row-name">{b.fullName}</span>
              <span className="admin-row-meta">{b.referenceCode} · {b.email}</span>
              <span className="admin-row-meta">{seatsByRow(b.seatIds).join('; ')}</span>
            </span>
            {row === 'sending' ? <span className="admin-badge" role="status">Sending…</span>
              : row === 'sent' ? <span className="admin-badge is-accent admin-badge-icon"><Check size={14} aria-hidden />Sent</span>
              : row === 'already_sent' ? <span className="admin-badge is-accent">Already sent</span>
              : row === 'failed' ? <span className="admin-badge is-gold">Didn’t send</span>
              : <span className="admin-badge">Not sent yet</span>}
            {row === 'failed' && step === 'finished' && <div className="admin-email-actions admin-qr-row-actions">
              <button className="btn-primary admin-btn-small" type="button" onClick={() => send([b.id])}><RefreshCw size={16} aria-hidden />Retry</button>
              {copy && <CopyButton text={copy.text} label={`email text for ${b.fullName}`}>Copy email text</CopyButton>}
              {copy && <CopyButton text={copy.subject} label={`email subject for ${b.fullName}`}>Copy subject</CopyButton>}
              <QrDownloadButton bookingId={b.id} reference={b.referenceCode} guest={b.fullName} />
            </div>}
          </li>
        })}
      </ul>

      <div className="admin-qr-actions">
        {step === 'idle' && <button className="btn-primary" type="button" onClick={() => setStep('confirm')}><Send size={18} aria-hidden />Send {emails(list.length)}</button>}
        {step === 'confirm' && <div className="admin-checkin-undo" role="group" aria-label="Confirm sending">
          <p>Send “Your check-in QR code” to {list.length === 1 ? 'this guest' : `these ${list.length} guests`} now? Each guest gets it once.</p>
          <div className="admin-checkin-buttons">
            <button className="btn-primary" type="button" onClick={() => send(list.map(b => b.id))}>Yes, send {emails(list.length)}</button>
            <button className="btn-ghost" type="button" onClick={() => setStep('idle')}>Cancel</button>
          </div>
        </div>}
        {step === 'sending' && <p className="admin-notice" role="status">Sending {Math.max(1, sending + 1)} of {list.length}…</p>}
        {step === 'finished' && <>
          <p className={`admin-notice${counts('failed') ? ' is-error' : ''}`} role="status">
            {[`${emails(counts('sent'))} sent`, counts('already_sent') && `${counts('already_sent')} already sent by someone else`, counts('failed') && `${counts('failed')} didn’t send: press Retry, or send it yourself (copy the text, put ${EMAIL_CC} in Cc and attach the downloaded QR code)`].filter(Boolean).join(' · ')}
          </p>
          <button className="btn-ghost" type="button" onClick={load}><RefreshCw size={16} aria-hidden />Check the list again</button>
        </>}
      </div>
    </>}
  </div>
}
