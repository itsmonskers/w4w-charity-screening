// "Copy email text" for /admin when the automatic email didn't send. Builds the exact
// text of the automatic email by calling buildEmail() from lib/email-templates.ts as-is
// (that file only imports event-config, plus a type from mailer, so it runs in the browser).
import type { AdminBooking } from './admin-api'
import { buildEmail } from './email-templates'

// The address the automatic emails come from and name as the contact (the SMTP_USER setting).
// It is public: the site footer and docs/email-templates.md show it too.
export const EMAIL_CONTACT = 'w4wph.movies4water@gmail.com'

// 'checkin': the separate "Your check-in QR code" email (one-time send)
export type DecisionEmail = 'approved' | 'rejected' | 'checkin'

// The text can't carry the QR image: the confirmed and check-in texts include the QR box
// wording, and the admin attaches the image from "Download QR code".
export function decisionEmail(kind: DecisionEmail, booking: AdminBooking) {
  const email = buildEmail(kind, {
    referenceCode: booking.referenceCode,
    fullName: booking.fullName,
    contact: booking.contact,
    email: booking.email,
    organization: booking.organization,
    notes: booking.notes,
    seatIds: booking.seatIds,
    seatCount: booking.seatCount,
    // The server reads price_per_seat; the booking's amount is always price × seats
    // (set once by reserve_seats and never changed), so this is the same number.
    pricePerSeat: booking.amount === null ? null : booking.amount / booking.seatCount,
    amount: booking.amount,
    paymentRef: booking.paymentRef,
    payerName: booking.payerName,
    // The confirmed / not-approved emails don't show food allergies (same as the server)
  }, EMAIL_CONTACT, { checkInQr: kind === 'approved' })
  return { to: email.to, subject: email.subject, text: email.text }
}
