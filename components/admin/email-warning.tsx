'use client'

import { useRef } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import type { AdminBooking } from '@/lib/admin-api'
import { EMAIL_CONTACT, decisionEmail, type DecisionEmail } from '@/lib/admin-email-copy'
import { CopyButton } from './copy-button'
import { QrDownloadButton } from './qr-download'

// receipt: an Acknowledgment Receipt was picked when confirming (the copied text says it's attached)
export type EmailWarningItem = { key: string; kind: DecisionEmail; booking: AdminBooking; receipt?: boolean }

// Emails that didn't send. Stays on screen (every page) until each one is dismissed.
export function EmailWarnings({ warnings, onDismiss, onAllDismissed }: { warnings: EmailWarningItem[]; onDismiss: (key: string) => void; onAllDismissed: () => void }) {
  const list = useRef<HTMLUListElement>(null)
  if (!warnings.length) return null

  // Keep keyboard focus nearby: the next warning's Dismiss button, or the page title when none are left
  function dismiss(index: number) {
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>('.admin-email-dismiss') ?? [])]
    const nextButton = buttons[index + 1] ?? buttons[index - 1]
    onDismiss(warnings[index].key)
    if (nextButton) requestAnimationFrame(() => nextButton.focus())
    else onAllDismissed()
  }

  return <section className="admin-email-warnings" aria-labelledby="email-warnings-title">
    <h2 className="admin-email-warnings-title" id="email-warnings-title"><AlertTriangle size={20} aria-hidden />{warnings.length === 1 ? '1 email did not send' : `${warnings.length} emails did not send`}</h2>
    <ul ref={list}>
      {warnings.map(({ key, kind, booking, receipt }, index) => {
        const email = decisionEmail(kind, booking, { receipt })
        const what = kind === 'rejected' ? 'not approved' : 'confirmed'
        const name = kind === 'approved' ? 'Booking confirmed' : kind === 'rejected' ? 'Booking not approved' : 'Your check-in QR code'
        return <li key={key} className="admin-email-warning">
          <p>The ‘{name}’ email to <strong>{booking.fullName}</strong> (<strong>{booking.email}</strong>) did not send. The booking is still {what}. Please send it yourself from {EMAIL_CONTACT}{email.cc && <>, with <strong>{email.cc}</strong> in Cc</>}{kind === 'rejected' ? '' : ` and the downloaded QR code${receipt ? ' and the Acknowledgment Receipt' : ''} attached`}.</p>
          <div className="admin-email-actions">
            <CopyButton text={email.text} label={`email text for ${booking.fullName}`}>Copy email text</CopyButton>
            <CopyButton text={email.subject} label={`email subject for ${booking.fullName}`}>Copy subject</CopyButton>
            {kind !== 'rejected' && <QrDownloadButton bookingId={booking.id} reference={booking.referenceCode} guest={booking.fullName} />}
            <button className="btn-ghost admin-btn-small admin-email-dismiss" type="button" onClick={() => dismiss(index)} aria-label={`I’ve sent the email to ${booking.fullName} by hand`}><Check size={16} aria-hidden />I’ve sent it</button>
          </div>
        </li>
      })}
    </ul>
  </section>
}
