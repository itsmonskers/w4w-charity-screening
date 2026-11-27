// Sends the booking emails. Not an open relay: the browser only says WHICH
// booking and WHICH email; the address and content always come from the database.
// - received: anyone who knows the reference code AND payment reference (only the
//   guest who just booked); claim_received_email allows it once per booking.
// - approved / rejected: admins only (their login token, checked with is_admin),
//   and only when the booking really has that status. "approved" carries the check-in
//   QR (migration 007): inline, as a file, and a link to /api/qr/[token]; without 007 it goes
//   out without the QR, and the reply says so (qr: false). Optionally with the Acknowledgment
//   Receipt the admin picked (form data, "receipt"): attached, never stored.
// - checkin: admins only, confirmed bookings only, once per booking (claim_checkin_email):
//   the separate "Your check-in QR code" email for bookings confirmed before the QR existed.
// Uses the anon key only; never the service_role key.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { checkinQrAttachments } from '@/lib/checkin-qr'
import { buildEmail, type EmailBooking } from '@/lib/email-templates'
import { SMTP_USER, sendEmail, type EmailAttachment } from '@/lib/mailer'
import { RECEIPT_MAX_BYTES, receiptFilename, receiptType } from '@/lib/receipt-file'

export const runtime = 'nodejs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// reason already_sent: the check-in QR email was sent before (or is being sent right now).
// qr (confirmed email only): whether the QR image went with it; false = /admin shows
// "Sent without the QR code" (the booking stays on Send check-in QR codes).
// reason bad_receipt: the attached AR isn't a PDF, JPG or PNG of at most 3 MB (nothing sent).
type ReplyExtra = { reason?: 'already_sent' | 'bad_receipt'; qr?: boolean }
const reply = (sent: boolean, status = 200, extra: ReplyExtra = {}) => Response.json({ sent, ...extra }, { status })
const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max

// A fresh client per request, acting as the visitor (anon) or as the signed-in admin.
const db = (token?: string) => createClient(url!, anonKey!, {
  auth: { persistSession: false, autoRefreshToken: false },
  ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
})

// The booking details every email shows (claim_received_email returns these plus food_allergies,
// which only the "received" email shows). Never review_note.
const DETAIL_COLUMNS = 'full_name, contact, email, organization, notes, seat_ids, seat_count, price_per_seat, amount, payment_ref, payer_name'
type DetailsRow = {
  full_name: string; contact: string; email: string; organization: string | null; notes: string | null
  seat_ids: string[]; seat_count: number; price_per_seat: number | string | null; amount: number | string | null
  payment_ref: string | null; payer_name: string | null
  food_allergies?: string | null
}
type BookingRow = DetailsRow & { reference_code: string; status: string }

const toNumber = (value: unknown) => value === null || value === undefined ? null : Number(value)
const toEmailBooking = (referenceCode: string, row: DetailsRow): EmailBooking => ({
  referenceCode,
  fullName: row.full_name,
  contact: row.contact,
  email: row.email,
  organization: row.organization,
  notes: row.notes,
  seatIds: row.seat_ids,
  seatCount: row.seat_count,
  pricePerSeat: toNumber(row.price_per_seat),
  amount: toNumber(row.amount),
  paymentRef: row.payment_ref,
  payerName: row.payer_name,
  foodAllergies: row.food_allergies,
})

export async function POST(request: Request) {
  if (!url || !anonKey) return reply(false, 503)
  // JSON, or form data when the admin attached an Acknowledgment Receipt to the confirmed email
  const form = request.headers.get('content-type')?.startsWith('multipart/form-data') ? await request.formData().catch(() => null) : null
  const body = form
    ? Object.fromEntries([...form.entries()].filter(([, value]) => typeof value === 'string'))
    : await request.json().catch(() => null) as Record<string, unknown> | null
  const receiptFile = form?.get('receipt') ?? null
  const kind = body?.kind
  if (receiptFile !== null && kind !== 'approved') return reply(false, 400)

  if (kind === 'received') {
    const { referenceCode, paymentRef } = body!
    if (!isText(referenceCode, 40) || !isText(paymentRef, 60)) return reply(false, 400)
    const { data, error } = await db().rpc('claim_received_email', { p_reference_code: referenceCode, p_payment_ref: paymentRef })
    if (error) {
      console.error('[email] received: claim failed', error.message)
      return reply(false, 500)
    }
    const row = (data as DetailsRow[])[0]
    if (!row) return reply(false, 404)
    return reply(await sendEmail(buildEmail('received', toEmailBooking(referenceCode.trim().toUpperCase(), row), SMTP_USER)))
  }

  if (kind === 'approved' || kind === 'rejected' || kind === 'checkin') {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    const { bookingId } = body!
    if (!token) return reply(false, 401)
    if (!isText(bookingId, 64)) return reply(false, 400)
    const client = db(token)
    const admin = await client.rpc('is_admin')
    if (admin.error || admin.data !== true) return reply(false, 403)
    const { data, error } = await client
      .from('bookings')
      .select(`reference_code, status, ${DETAIL_COLUMNS}`)
      .eq('id', bookingId)
      .maybeSingle()
    if (error) {
      console.error(`[email] ${kind}: booking lookup failed`, error.message)
      return reply(false, 500)
    }
    const row = data as BookingRow | null
    if (!row || row.status !== (kind === 'checkin' ? 'approved' : kind)) return reply(false, 409)
    const booking = toEmailBooking(row.reference_code, row)
    if (kind === 'rejected') return reply(await sendEmail(buildEmail(kind, booking, SMTP_USER)))

    // The AR (confirmed email only): checked from its contents, attached, never stored. A bad
    // file sends nothing, so /admin shows the warning and the admin sends it by hand.
    const receipt = receiptFile === null ? null : await readReceipt(receiptFile, booking.referenceCode)
    if (receiptFile !== null && !receipt) return reply(false, 400, { reason: 'bad_receipt' })
    const withReceipt = receipt ? [receipt] : []

    // approved / checkin: with the check-in QR when the booking has a token (migration 007): inline,
    // as a file to save, and the "Open your QR code" link. The link uses this request's address,
    // so an email sent from a preview links to that preview. Never log the link or the token.
    const checkinToken = await readCheckinToken(client, bookingId)
    const qrLink = checkinToken ? `${new URL(request.url).origin}/api/qr/${checkinToken}` : undefined
    const qr = checkinToken ? await checkinQrAttachments(checkinToken, booking.referenceCode).catch(qrError => {
      console.error('[email] check-in QR image failed', qrError instanceof Error ? qrError.message : qrError)
      return null
    }) : null
    // No image: the confirmed email still goes (with the link if the token was read), and isn't
    // marked as the QR email, so the booking stays on "Send check-in QR codes".
    if (kind === 'approved' && !qr) return reply(await sendEmail({ ...buildEmail(kind, booking, SMTP_USER, { qrLink, receipt: !!receipt }), attachments: withReceipt }), 200, { qr: false })
    if (!qr) return reply(false, 500)
    // Marks the QR email as sent in one step, so the one-time send can't send it twice.
    // For "approved" a false here doesn't stop the email: the guest must get their confirmation.
    const claim = await client.rpc('claim_checkin_email', { p_booking_id: bookingId })
    if (kind === 'checkin' && (claim.error || claim.data !== true)) {
      if (claim.error) console.error('[email] checkin: claim failed', claim.error.message)
      return claim.error ? reply(false, 500) : reply(false, 409, { reason: 'already_sent' })
    }
    const sent = await sendEmail({ ...buildEmail(kind, booking, SMTP_USER, { checkInQr: true, qrLink, receipt: !!receipt }), attachments: [...qr, ...withReceipt] })
    // Not sent: release the mark so it shows again in "Send check-in QR codes" for a retry
    if (!sent && claim.data === true) await client.rpc('release_checkin_email', { p_booking_id: bookingId })
    return reply(sent, 200, kind === 'approved' ? { qr: true } : {})
  }

  return reply(false, 400)
}

// The AR as an email attachment, or null when it isn't a PDF, JPG or PNG of at most 3 MB
// (checked from the file's first bytes, not its name). Named Movies4Water-AR-[reference].[ext].
async function readReceipt(value: FormDataEntryValue, referenceCode: string): Promise<EmailAttachment | null> {
  if (typeof value === 'string' || value.size === 0 || value.size > RECEIPT_MAX_BYTES) return null
  const content = Buffer.from(await value.arrayBuffer())
  const type = receiptType(content.subarray(0, 8))
  return type ? { filename: receiptFilename(referenceCode, type), content, contentType: type.contentType } : null
}

// The booking's check-in QR secret, or null (before migration 007, or if it can't be read)
async function readCheckinToken(client: SupabaseClient, bookingId: string): Promise<string | null> {
  const { data, error } = await client.from('bookings').select('checkin_token').eq('id', bookingId).maybeSingle()
  if (error) {
    console.error('[email] check-in QR token unavailable, sending without the QR', error.message)
    return null
  }
  const token = (data as { checkin_token?: unknown } | null)?.checkin_token
  return typeof token === 'string' && token ? token : null
}
