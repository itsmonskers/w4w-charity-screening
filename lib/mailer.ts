// Server only: sends email through Gmail SMTP. Imported by app/api/booking-email
// and nothing else. SMTP_USER / SMTP_APP_PASSWORD must never be NEXT_PUBLIC_.
import nodemailer from 'nodemailer'

export type Email = { to: string; subject: string; html: string; text: string }

// The Gmail address emails are sent from; also the contact address in every email.
export const SMTP_USER = process.env.SMTP_USER ?? ''
const SMTP_APP_PASSWORD = process.env.SMTP_APP_PASSWORD ?? ''

export const MAILER_AVAILABLE = !!SMTP_USER && !!SMTP_APP_PASSWORD

const transport = MAILER_AVAILABLE
  ? nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: SMTP_USER, pass: SMTP_APP_PASSWORD } })
  : null

// Returns false (and logs) instead of throwing: a failed email must never fail a booking.
export async function sendEmail(email: Email): Promise<boolean> {
  if (!transport) {
    console.error('[email] not sent: SMTP_USER or SMTP_APP_PASSWORD is missing')
    return false
  }
  try {
    await transport.sendMail({ from: { name: 'Waves for Water PH', address: SMTP_USER }, replyTo: SMTP_USER, ...email })
    return true
  } catch (error) {
    console.error(`[email] not sent: "${email.subject}"`, error instanceof Error ? error.message : error)
    return false
  }
}
