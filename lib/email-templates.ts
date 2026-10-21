// Server only: the three booking emails, each as plain HTML + a text version.
// Event facts come from event-config; the contact address is the SMTP_USER env var.
// No images, no Marvel assets.
import { EVENT, formatPrice } from './event-config'
import type { Email } from './mailer'

export type EmailKind = 'received' | 'approved' | 'rejected'
export type EmailBooking = {
  referenceCode: string
  fullName: string
  contact: string
  email: string
  organization: string | null
  notes: string | null
  seatIds: string[]
  seatCount: number
  pricePerSeat: number | null
  amount: number | null
  paymentRef: string | null
  payerName: string | null
}

const EVENT_NAME = `Movies4Water - ${EVENT.film} Block Screening`
const WHEN = `${EVENT.date} · ${EVENT.time}`
const WHERE = `Cinema 7, ${EVENT.venue}`

// "Row L · Seats 7, 8, 9", one line per row (same format as /admin)
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

// "₱2,000 (2 × ₱1,000)"; amount is null for bookings made before the price was set
function amountText({ amount, pricePerSeat, seatCount }: EmailBooking) {
  if (amount === null) return '[PRICE TBD]'
  return pricePerSeat === null ? formatPrice(amount) : `${formatPrice(amount)} (${seatCount} × ${formatPrice(pricePerSeat)})`
}

const seatLabel = (count: number) => `${count} seat${count === 1 ? '' : 's'}`

// The same booking details in all 3 emails, matching /admin (never the review note).
// Optional fields only when the guest filled them in. Each line is escaped in the HTML version.
function bookingDetails(booking: EmailBooking): [string, string[]][] {
  const optional = (label: string, value: string | null): [string, string[]][] => value ? [[label, value.split(/\r?\n/)]] : []
  return [
    ['Reference', [booking.referenceCode]],
    ['Event', [EVENT_NAME]],
    ['When', [WHEN]],
    ['Where', [WHERE]],
    ['Name', [booking.fullName]],
    ['Email', [booking.email]],
    ['Mobile / Messenger', [booking.contact]],
    ...optional('Organization', booking.organization),
    ['Seats', seatsByRow(booking.seatIds)],
    ['Number of seats', [seatLabel(booking.seatCount)]],
    ['Amount', [amountText(booking)]],
    ['Payment reference', [booking.paymentRef ?? '–']],
    ...optional('Paid by', booking.payerName),
    ['Payment screenshot', ['received']],
    ...optional('Notes', booking.notes),
  ]
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

type Content = { subject: string; status: string; intro: string[]; outro: string[] }

const CONTENT: Record<EmailKind, (contact: string) => Content> = {
  received: contact => ({
    subject: 'Booking received – pending verification',
    status: 'Pending verification',
    intro: [`Thanks for booking! We received your reservation and payment screenshot for ${EVENT_NAME}.`],
    outro: [
      'We will check your payment and email you again once it is verified. Please keep your reference code.',
      'Our updates sometimes land in spam. Please check your spam or junk folder, and mark this address as not spam.',
      `Questions? Reply to this email or write to ${contact} with your reference code.`,
    ],
  }),
  approved: contact => ({
    subject: 'Booking confirmed',
    status: 'Confirmed',
    intro: [`Your payment is verified and your seats for ${EVENT_NAME} are confirmed.`],
    outro: [
      'Please keep your reference code. Thank you for helping bring clean water to Filipino communities.',
      `Questions? Reply to this email or write to ${contact} with your reference code.`,
    ],
  }),
  rejected: contact => ({
    subject: 'Booking not approved',
    status: 'Not approved',
    intro: [
      `We're sorry, but we could not verify the payment for your reservation for ${EVENT_NAME}.`,
      'The seats below are no longer held for you.',
    ],
    outro: [`Please contact us at ${contact} with your reference code so we can help.`],
  }),
}

export function buildEmail(kind: EmailKind, booking: EmailBooking, contact: string): Email {
  const content = CONTENT[kind](contact)
  const details = bookingDetails(booking)
  const subject = `${content.subject} · ${booking.referenceCode} · Movies4Water`

  const text = [
    `Hi ${booking.fullName},`,
    '',
    `${booking.referenceCode} · ${content.status}`,
    '',
    ...content.intro,
    '',
    ...details.map(([label, lines]) => `${label}: ${lines.join('\n    ')}`),
    '',
    ...content.outro.flatMap(line => [line, '']),
    'Waves for Water Philippines',
    contact,
  ].join('\n')

  const p = (line: string) => `<p>${escapeHtml(line)}</p>`
  const html = [
    '<!doctype html><html><body style="font-family: Arial, sans-serif; line-height: 1.5;">',
    p(`Hi ${booking.fullName},`),
    `<p><strong>${escapeHtml(`${booking.referenceCode} · ${content.status}`)}</strong></p>`,
    ...content.intro.map(p),
    '<table cellpadding="4" cellspacing="0">',
    ...details.map(([label, lines]) => `<tr><td valign="top"><strong>${escapeHtml(label)}</strong></td><td>${lines.map(escapeHtml).join('<br>')}</td></tr>`),
    '</table>',
    ...content.outro.map(p),
    `<p>Waves for Water Philippines<br>${escapeHtml(contact)}</p>`,
    '</body></html>',
  ].join('\n')

  return { to: booking.email, subject, html, text }
}
