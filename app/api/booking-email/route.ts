// Sends the three booking emails. Not an open relay: the browser only says WHICH
// booking and WHICH email; the address and content always come from the database.
// - received: anyone who knows the reference code AND payment reference (only the
//   guest who just booked); claim_received_email allows it once per booking.
// - approved / rejected: admins only (their login token, checked with is_admin),
//   and only when the booking really has that status.
// Uses the anon key only; never the service_role key.
import { createClient } from '@supabase/supabase-js'
import { buildEmail, type EmailBooking } from '@/lib/email-templates'
import { SMTP_USER, sendEmail } from '@/lib/mailer'

export const runtime = 'nodejs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const reply = (sent: boolean, status = 200) => Response.json({ sent }, { status })
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
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const kind = body?.kind

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

  if (kind === 'approved' || kind === 'rejected') {
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
    if (!row || row.status !== kind) return reply(false, 409)
    return reply(await sendEmail(buildEmail(kind, toEmailBooking(row.reference_code, row), SMTP_USER)))
  }

  return reply(false, 400)
}
