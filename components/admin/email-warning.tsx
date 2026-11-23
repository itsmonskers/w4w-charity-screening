'use client'

import { useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import type { AdminBooking } from '@/lib/admin-api'
import { EMAIL_CONTACT, decisionEmail, type DecisionEmail } from '@/lib/admin-email-copy'
import { CopyButton } from './copy-button'

export type EmailWarningItem = { key: string; kind: DecisionEmail; booking: AdminBooking }

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
      {warnings.map(({ key, kind, booking }, index) => {
        const email = decisionEmail(kind, booking)
        const what = kind === 'approved' ? 'confirmed' : 'not approved'
        return <li key={key} className="admin-email-warning">
          <p>The ‘{kind === 'approved' ? 'Booking confirmed' : 'Booking not approved'}’ email to <strong>{booking.fullName}</strong> (<strong>{booking.email}</strong>) did not send. The booking is still {what}. Please send it yourself from {EMAIL_CONTACT}.</p>
          <div className="admin-email-actions">
            <CopyButton text={email.text} label={`email text for ${booking.fullName}`}>Copy email text</CopyButton>
            <CopyButton text={email.subject} label={`email subject for ${booking.fullName}`}>Copy subject</CopyButton>
            <button className="btn-ghost admin-btn-small admin-email-dismiss" type="button" onClick={() => dismiss(index)} aria-label={`Dismiss: email to ${booking.fullName} sent by hand`}><X size={16} aria-hidden />Dismiss</button>
          </div>
        </li>
      })}
    </ul>
  </section>
}
