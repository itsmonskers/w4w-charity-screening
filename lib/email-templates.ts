// The booking emails, each as plain HTML + a text version. Event facts come from
// event-config; the contact address is the SMTP_USER env var. No Marvel assets.
// The only image is the check-in QR ("Booking confirmed" and "Your check-in QR code"
// emails): the HTML points at an attached image (cid:), which the email route adds.
// This file never makes the QR itself, so /admin can also build the text in the browser.
import { CHECKIN_QR_CID } from './checkin-code'
import { EVENT, formatPrice } from './event-config'
import type { Email } from './mailer'

// 'checkin': the separate "Your check-in QR code" email, for bookings confirmed before
// the QR was added to the "Booking confirmed" email
export type EmailKind = 'received' | 'approved' | 'rejected' | 'checkin'
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
  // "received" email only; absent for approved / rejected
  foodAllergies?: string | null
}

// Jenna (W4W): the contact person in the "Booking confirmed" email, and she gets a copy (Cc) of
// the confirmed, not-approved and "Your check-in QR code" emails. Not the "received" email: it
// carries food allergies. The only place her details are set; kept here, not in mailer.ts,
// because /admin builds the same emails in the browser.
const JENNA = { name: 'Jenna Escueta', phone: '+63 993 502 1347', email: 'jenna@wavesforwater.org' }
export const EMAIL_CC = JENNA.email
const CC_KINDS: EmailKind[] = ['approved', 'rejected', 'checkin']

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
    ...optional('Food allergies', booking.foodAllergies ?? null),
  ]
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// What the email says. status: the "W4W-DD-7K2Q · Status" line under the greeting (left out
// when absent). Each outro / signoff entry is one paragraph; a string[] is one paragraph of lines.
// attached: the confirmed email's "Attached…" paragraph, after the intro.
type Content = { subject: string; greeting: string; status?: string; intro: string[]; attached?: string[]; outro: (string | string[])[]; signoff: string[] }
// What the "Booking confirmed" email really carries, so its "Attached…" sentence is true
type Attached = { qr: boolean; receipt: boolean }

// "Attached…" sentence of the confirmed email (Jenna's wording; "AR only" by Simon). No QR and
// no AR: no sentence at all. AR without the QR (image failed): the QR follows separately, from
// Send check-in QR codes.
function attachedSentence({ qr, receipt }: Attached): string[] {
  if (!qr) return receipt ? ['Attached to this email is your Acknowledgment Receipt. Your entry QR code will follow in a separate email.'] : []
  return [receipt
    ? 'Attached to this email are your entry QR code and Acknowledgment Receipt. Kindly save your QR code and present it upon entry to the cinema for your block screening.'
    : 'Attached to this email is your entry QR code. Kindly save your QR code and present it upon entry to the cinema for your block screening.']
}

// Jenna's ending, shared by the "Booking confirmed" and "Your check-in QR code" emails
const JENNA_OUTRO: Content['outro'] = [
  'Should you have any questions or concerns, feel free to contact:',
  [JENNA.name, `📞 ${JENNA.phone}`, `✉️ ${JENNA.email}`],
  'Thank you for supporting Movies4Water and helping bring clean water to communities!',
]
const JENNA_SIGNOFF = ['See you at the screening!', 'Waves For Water Philippines']

const CONTENT: Record<EmailKind, (contact: string, attached: Attached) => Content> = {
  received: contact => ({
    subject: 'Booking received – pending verification',
    greeting: ',',
    status: 'Pending verification',
    intro: [`Thanks for booking! We received your reservation and payment screenshot for ${EVENT_NAME}.`],
    outro: [
      'We will check your payment and email you again once it is verified. Please keep your reference code.',
      'Our updates sometimes land in spam. Please check your spam or junk folder, and mark this address as not spam.',
      `Questions? Reply to this email or write to ${contact} with your reference code.`,
    ],
    signoff: ['Waves For Water Philippines', contact],
  }),
  // Jenna's text (approved 2026-11-27): no status line; her contact details instead of the inbox
  approved: (_contact, attached) => ({
    subject: 'Booking confirmed',
    greeting: '!',
    intro: ['Thank you for purchasing a ticket to Movies4Water! Your payment has been confirmed. 🎬💙'],
    attached: attachedSentence(attached),
    outro: JENNA_OUTRO,
    signoff: JENNA_SIGNOFF,
  }),
  rejected: contact => ({
    subject: 'Booking not approved',
    greeting: ',',
    status: 'Not approved',
    intro: [
      `We're sorry, but we could not verify the payment for your reservation for ${EVENT_NAME}.`,
      'The seats below are no longer held for you.',
    ],
    outro: [`Please contact us at ${contact} with your reference code so we can help.`],
    signoff: ['Waves For Water Philippines', contact],
  }),
  // Same style as the confirmed email (2026-11-27): no status line, Jenna's ending
  checkin: () => ({
    subject: 'Your check-in QR code',
    greeting: ',',
    intro: ['Here\'s your QR code for check-in on December 19.'],
    outro: JENNA_OUTRO,
    signoff: JENNA_SIGNOFF,
  }),
}

// "Your check-in QR code" box: the QR (attached image), the "Open your QR code" link with how to
// save it, the reference code in large text, the seats, and what to do at the door.
// Wording approved by Simon. image: the QR is attached; link: /api/qr/[token] (either can be
// missing: no link in the copied text, no image when making it failed but the token was read).
const QR_TITLE = 'Your check-in QR code'
const QR_NOTE = 'Show this at the cinema entrance. Can\'t open it? Just tell our staff your reference code.'
const QR_BUTTON = 'Open your QR code'
const QR_SAVE = 'Open your QR code, then press and hold it to save it, or take a screenshot. Save it to your phone before the event, in case the mall\'s signal is weak.'
type QrBox = { image: boolean; link?: string }

function qrBoxText(booking: EmailBooking, { image, link }: QrBox) {
  return [
    QR_TITLE.toUpperCase(),
    ...(image ? ['(QR code attached)'] : []),
    ...(link ? [`${QR_BUTTON}: ${link}`, QR_SAVE] : []),
    `Reference code: ${booking.referenceCode}`,
    ...seatsByRow(booking.seatIds).map((line, i) => i ? `    ${line}` : `Seats: ${line}`),
    QR_NOTE,
  ]
}

// Table layout and inline styles only, so it holds together in Gmail and Outlook. The button is
// a bordered link with no fill colour (emails can't use the site's colour tokens, and no hex).
function qrBoxHtml(booking: EmailBooking, { image, link }: QrBox) {
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 16px 0; border: 2px solid; border-radius: 12px;"><tr><td style="padding: 16px 20px; text-align: center;">',
    `<p style="margin: 0 0 12px; font-size: 18px; font-weight: bold;">${escapeHtml(QR_TITLE)}</p>`,
    ...(image ? [`<img src="cid:${CHECKIN_QR_CID}" width="220" height="220" alt="${escapeHtml(`Check-in QR code for ${booking.referenceCode}`)}" style="display: block; margin: 0 auto; border: 0;">`] : []),
    ...(link ? [
      '<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin: 16px auto 8px;"><tr>',
      `<td style="border: 2px solid; border-radius: 999px;"><a href="${escapeHtml(link)}" style="display: inline-block; padding: 12px 24px; font-size: 16px; font-weight: bold;">${escapeHtml(QR_BUTTON)}</a></td>`,
      '</tr></table>',
      `<p style="margin: 0 0 4px; font-size: 16px; font-weight: bold;">${escapeHtml(QR_SAVE)}</p>`,
    ] : []),
    `<p style="margin: 12px 0 4px; font-size: 28px; font-weight: bold; letter-spacing: 2px;">${escapeHtml(booking.referenceCode)}</p>`,
    `<p style="margin: 0 0 12px;">${seatsByRow(booking.seatIds).map(escapeHtml).join('<br>')}</p>`,
    `<p style="margin: 0;">${escapeHtml(QR_NOTE)}</p>`,
    '</td></tr></table>',
  ].join('\n')
}

// checkInQr: the "Booking confirmed" email carries the QR image (the route attaches it).
// qrLink: the "Open your QR code" link (/api/qr/[token]); the confirmed email shows the QR box
// with the link even when the image couldn't be made. Never in the copied text.
// receipt: the confirmed email also carries the Acknowledgment Receipt (only changes the
// "Attached…" sentence; the route attaches the file). The "Your check-in QR code" email
// always has the QR box (with the image), and no booking details table.
export function buildEmail(kind: EmailKind, booking: EmailBooking, contact: string, options: { checkInQr?: boolean; qrLink?: string; receipt?: boolean } = {}): Email {
  const qrImage = kind === 'checkin' || (kind === 'approved' && options.checkInQr === true)
  const qrBox: QrBox = { image: qrImage, link: kind === 'checkin' || kind === 'approved' ? options.qrLink : undefined }
  const withQr = qrBox.image || !!qrBox.link
  const content = CONTENT[kind](contact, { qr: qrImage, receipt: options.receipt === true })
  const details = kind === 'checkin' ? [] : bookingDetails(booking)
  const subject = `${content.subject} · ${booking.referenceCode} · Movies4Water`
  const greeting = `Hi ${booking.fullName}${content.greeting}`
  const status = content.status && `${booking.referenceCode} · ${content.status}`
  const paragraph = (entry: string | string[]) => typeof entry === 'string' ? [entry] : entry

  const text = [
    greeting,
    '',
    ...(status ? [status, ''] : []),
    ...content.intro,
    '',
    ...(content.attached?.length ? [...content.attached, ''] : []),
    ...(withQr ? [...qrBoxText(booking, qrBox), ''] : []),
    ...(details.length ? [...details.map(([label, lines]) => `${label}: ${lines.join('\n    ')}`), ''] : []),
    ...content.outro.flatMap(entry => [...paragraph(entry), '']),
    ...content.signoff,
  ].join('\n')

  const p = (entry: string | string[]) => `<p>${paragraph(entry).map(escapeHtml).join('<br>')}</p>`
  const html = [
    '<!doctype html><html><body style="font-family: Arial, sans-serif; line-height: 1.5;">',
    p(greeting),
    ...(status ? [`<p><strong>${escapeHtml(status)}</strong></p>`] : []),
    ...content.intro.map(p),
    ...(content.attached ?? []).map(p),
    ...(withQr ? [qrBoxHtml(booking, qrBox)] : []),
    ...(details.length ? [
      '<table cellpadding="4" cellspacing="0">',
      ...details.map(([label, lines]) => `<tr><td valign="top"><strong>${escapeHtml(label)}</strong></td><td>${lines.map(escapeHtml).join('<br>')}</td></tr>`),
      '</table>',
    ] : []),
    ...content.outro.map(p),
    p(content.signoff),
    '</body></html>',
  ].join('\n')

  return { to: booking.email, ...(CC_KINDS.includes(kind) ? { cc: EMAIL_CC } : {}), subject, html, text }
}
