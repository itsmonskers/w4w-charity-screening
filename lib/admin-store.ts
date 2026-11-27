// Data layer for /admin (payment verification). Supabase only: there is no mock,
// because bookings and admin accounts only exist in the real database.
// Uses the anon key + the admin's own login; never the service_role key.
import { supabase } from './supabase'

export type BookingStatus = 'pending' | 'approved' | 'rejected'
export type AdminBooking = {
  id: string
  referenceCode: string
  fullName: string
  contact: string
  email: string
  organization: string | null
  notes: string | null
  seatIds: string[]
  seatCount: number
  amount: number | null
  screenshotPath: string
  // null only for bookings made before migration 002
  paymentRef: string | null
  payerName: string | null
  foodAllergies: string | null
  status: BookingStatus
  reviewNote: string | null
  reviewedAt: string | null
  createdAt: string
}
export type SeatCounts = { available: number; reserved: number; taken: number }
export type SignInResult = { ok: true } | { ok: false; error: 'invalid_credentials' | 'unknown' }
export type ReviewError = 'booking_not_pending' | 'booking_not_found' | 'not_admin' | 'unknown'
// emailSent: false when the guest's email failed; the review itself still succeeded.
// withoutQr: the confirmed email was sent, but without the check-in QR image.
export type ReviewResult = { ok: true; emailSent: boolean; withoutQr?: boolean } | { ok: false; error: ReviewError }

export const ADMIN_AVAILABLE = !!supabase

const BUCKET = 'payment-screenshots'
const SIGNED_URL_SECONDS = 60 * 60
// Reuse signed URLs across the 30-second refreshes; renew well before they expire.
const URL_REUSE_MS = 50 * 60 * 1000
const REVIEW_ERRORS: ReviewError[] = ['booking_not_pending', 'booking_not_found', 'not_admin']

const client = () => {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

const toNumber = (value: unknown) => value === null || value === undefined ? null : Number(value)

type BookingRow = {
  id: string; reference_code: string; full_name: string; contact: string; email: string
  organization: string | null; notes: string | null; seat_ids: string[]; seat_count: number
  amount: number | string | null; screenshot_path: string; payment_ref: string | null; payer_name: string | null; food_allergies: string | null; status: BookingStatus
  review_note: string | null; reviewed_at: string | null; created_at: string
}

const toBooking = (row: BookingRow): AdminBooking => ({
  id: row.id,
  referenceCode: row.reference_code,
  fullName: row.full_name,
  contact: row.contact,
  email: row.email,
  organization: row.organization,
  notes: row.notes,
  seatIds: row.seat_ids,
  seatCount: row.seat_count,
  amount: toNumber(row.amount),
  screenshotPath: row.screenshot_path,
  paymentRef: row.payment_ref,
  payerName: row.payer_name,
  foodAllergies: row.food_allergies,
  status: row.status,
  reviewNote: row.review_note,
  reviewedAt: row.reviewed_at,
  createdAt: row.created_at,
})

export async function signIn(email: string, password: string): Promise<SignInResult> {
  try {
    const { error } = await client().auth.signInWithPassword({ email: email.trim(), password })
    if (!error) return { ok: true }
    return { ok: false, error: error.code === 'invalid_credentials' ? 'invalid_credentials' : 'unknown' }
  } catch {
    return { ok: false, error: 'unknown' }
  }
}

export async function signOut() {
  urlCache.clear()
  await client().auth.signOut()
}

// Calls back with the signed-in email (or null) now and on every sign-in / sign-out.
export function onAuthChange(callback: (email: string | null) => void): () => void {
  const { data } = client().auth.onAuthStateChange((_event, session) => callback(session ? session.user.email ?? '' : null))
  return () => data.subscription.unsubscribe()
}

export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await client().rpc('is_admin')
  if (error) throw error
  return data === true
}

export async function getSeatCounts(): Promise<SeatCounts> {
  const { data, error } = await client().from('seats').select('status')
  if (error) throw error
  const counts: SeatCounts = { available: 0, reserved: 0, taken: 0 }
  for (const { status } of data as { status: keyof SeatCounts }[]) counts[status]++
  return counts
}

export async function getBookings(): Promise<AdminBooking[]> {
  const { data, error } = await client()
    .from('bookings')
    .select('id, reference_code, full_name, contact, email, organization, notes, seat_ids, seat_count, amount, screenshot_path, payment_ref, payer_name, food_allergies, status, review_note, reviewed_at, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as BookingRow[]).map(toBooking)
}

const urlCache = new Map<string, { url: string; at: number }>()

// Signed URL (60 min) for a payment screenshot; `download` makes the browser save it instead of showing it.
export async function getScreenshotUrl(path: string, download = false): Promise<string | null> {
  const key = `${download ? 'download' : 'view'}:${path}`
  const cached = urlCache.get(key)
  if (cached && Date.now() - cached.at < URL_REUSE_MS) return cached.url
  const { data, error } = await client().storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS, download ? { download: true } : undefined)
  if (error || !data) return null
  urlCache.set(key, { url: data.signedUrl, at: Date.now() })
  return data.signedUrl
}

// With an Acknowledgment Receipt, stop waiting after this long (slow mobile data): the booking is
// already confirmed, so the admin gets the "did not send" warning and sends it by hand.
const RECEIPT_EMAIL_TIMEOUT_MS = 60_000

// Asks the server to email the guest about the decision. Never throws.
// withoutQr: the server said the confirmed email went without the QR image (qr: false).
// receipt: the AR to attach to the confirmed email, sent as form data (never stored).
async function sendDecisionEmail(kind: 'approved' | 'rejected', bookingId: string, receipt?: File): Promise<{ emailSent: boolean; withoutQr?: boolean }> {
  try {
    const { data } = await client().auth.getSession()
    const token = data.session?.access_token
    if (!token) return { emailSent: false }
    let body: string | FormData = JSON.stringify({ kind, bookingId })
    if (receipt) {
      body = new FormData()
      body.append('kind', kind)
      body.append('bookingId', bookingId)
      body.append('receipt', receipt)
    }
    const response = await fetch('/api/booking-email', {
      method: 'POST',
      // Form data sets its own Content-Type (with the boundary)
      headers: receipt ? { Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body,
      ...(receipt ? { signal: AbortSignal.timeout(RECEIPT_EMAIL_TIMEOUT_MS) } : {}),
    })
    const result = await response.json() as { sent?: boolean; qr?: boolean }
    const emailSent = result.sent === true
    return emailSent && result.qr === false ? { emailSent, withoutQr: true } : { emailSent }
  } catch {
    return { emailSent: false }
  }
}

async function review(fn: 'approve_booking' | 'reject_booking', bookingId: string, note: string, receipt?: File): Promise<ReviewResult> {
  try {
    const { error } = await client().rpc(fn, { p_booking_id: bookingId, p_note: note.trim() || null })
    if (!error) return { ok: true, ...await sendDecisionEmail(fn === 'approve_booking' ? 'approved' : 'rejected', bookingId, receipt) }
    return { ok: false, error: REVIEW_ERRORS.find(known => known === error.message) ?? 'unknown' }
  } catch {
    return { ok: false, error: 'unknown' }
  }
}

// receipt: optional Acknowledgment Receipt for the confirmed email (checked by the caller and the server)
export const approveBooking = (bookingId: string, note: string, receipt?: File) => review('approve_booking', bookingId, note, receipt)
export const rejectBooking = (bookingId: string, note: string) => review('reject_booking', bookingId, note)

// ---------------------------------------------------------------------------
// Event-day check-in (migration 007). Separate from getBookings on purpose: if this code
// goes live before 007 is run, only the check-in screens show "not set up yet"; the
// payment screens keep working.
// ---------------------------------------------------------------------------

export type CheckInSeat = { seatId: string; checkedInAt: string | null; checkedInBy: string | null }
export type CheckInBooking = {
  bookingId: string
  referenceCode: string
  fullName: string
  status: BookingStatus
  foodAllergies: string | null
  seatIds: string[]
  // One per seat of a confirmed booking (empty for bookings that aren't confirmed)
  seats: CheckInSeat[]
}
export type CheckInError = 'not_admin' | 'booking_not_found' | 'booking_not_confirmed' | 'invalid_seats' | 'not_set_up' | 'unknown'
// booking null: no booking has that token ("Not a valid ticket")
export type CheckInLookup = { ok: true; booking: CheckInBooking | null } | { ok: false; error: CheckInError }
// changed: the seats this call checked in (or undid); seats already done are not in it
export type CheckInResult = { ok: true; changed: string[]; booking: CheckInBooking } | { ok: false; error: CheckInError }
// Per confirmed booking: how many of its seats have arrived, and when the latest one did
export type CheckInState = { total: number; arrived: number; bookings: Record<string, { seats: number; arrived: number; lastAt: string | null }> }

const CHECKIN_ERRORS: CheckInError[] = ['not_admin', 'booking_not_found', 'booking_not_confirmed', 'invalid_seats']

type CheckInJson = {
  booking_id: string; reference_code: string; full_name: string; status: BookingStatus
  food_allergies: string | null; seat_ids: string[]
  seats: { seat_id: string; checked_in_at: string | null; checked_in_by: string | null }[]
}

const toCheckInBooking = (row: CheckInJson): CheckInBooking => ({
  bookingId: row.booking_id,
  referenceCode: row.reference_code,
  fullName: row.full_name,
  status: row.status,
  foodAllergies: row.food_allergies,
  seatIds: row.seat_ids,
  seats: row.seats.map(s => ({ seatId: s.seat_id, checkedInAt: s.checked_in_at, checkedInBy: s.checked_in_by })),
})

// PostgREST says PGRST202 when a function doesn't exist: migration 007 hasn't been run
const checkInError = (error: { code?: string; message: string }): CheckInError =>
  error.code === 'PGRST202' ? 'not_set_up' : CHECKIN_ERRORS.find(known => known === error.message) ?? 'unknown'

// Counter and "Arrived" labels: every ticket (tickets exist only for confirmed bookings)
export async function getCheckInState(): Promise<CheckInState> {
  const { data, error } = await client().from('tickets').select('booking_id, checked_in_at')
  if (error) throw error
  const state: CheckInState = { total: 0, arrived: 0, bookings: {} }
  for (const { booking_id, checked_in_at } of data as { booking_id: string; checked_in_at: string | null }[]) {
    const entry = state.bookings[booking_id] ??= { seats: 0, arrived: 0, lastAt: null }
    state.total++
    entry.seats++
    if (!checked_in_at) continue
    state.arrived++
    entry.arrived++
    if (!entry.lastAt || checked_in_at > entry.lastAt) entry.lastAt = checked_in_at
  }
  return state
}

async function lookup(fn: 'checkin_lookup' | 'checkin_booking', args: Record<string, string>): Promise<CheckInLookup> {
  try {
    const { data, error } = await client().rpc(fn, args)
    if (error) return { ok: false, error: checkInError(error) }
    return { ok: true, booking: data ? toCheckInBooking(data as CheckInJson) : null }
  } catch {
    return { ok: false, error: 'unknown' }
  }
}

// A scanned QR's token (without the "W4W1:" prefix)
export const lookupCheckIn = (token: string) => lookup('checkin_lookup', { p_token: token })
// A booking picked from the search list
export const getCheckInBooking = (bookingId: string) => lookup('checkin_booking', { p_booking_id: bookingId })

async function changeCheckIn(fn: 'check_in_seats' | 'undo_check_in', bookingId: string, seatIds: string[]): Promise<CheckInResult> {
  try {
    const { data, error } = await client().rpc(fn, { p_booking_id: bookingId, p_seat_ids: seatIds })
    if (error) return { ok: false, error: checkInError(error) }
    const result = data as { changed: string[]; booking: CheckInJson }
    return { ok: true, changed: result.changed, booking: toCheckInBooking(result.booking) }
  } catch {
    return { ok: false, error: 'unknown' }
  }
}

// One database step: only seats not yet checked in are marked, so two phones can't both do it
export const checkInSeats = (bookingId: string, seatIds: string[]) => changeCheckIn('check_in_seats', bookingId, seatIds)
export const undoCheckIn = (bookingId: string, seatIds: string[]) => changeCheckIn('undo_check_in', bookingId, seatIds)

// Check-in history (migration 008, checkin_history): every check-in and undo, newest first.
// adminName: the admin's label, or their login email when it's empty. No allergies or contact details.
export type CheckInHistoryEntry = { id: number; at: string; action: 'check_in' | 'undo'; bookingId: string; referenceCode: string; fullName: string; seatIds: string[]; adminName: string }
// error not_set_up: migration 008 hasn't been run
export type CheckInHistory = { ok: true; entries: CheckInHistoryEntry[] } | { ok: false; error: CheckInError }

type CheckInHistoryRow = { id: number; created_at: string; action: 'check_in' | 'undo'; booking_id: string; reference_code: string; full_name: string; seat_ids: string[]; admin_name: string }

export async function getCheckInHistory(): Promise<CheckInHistory> {
  try {
    const { data, error } = await client().rpc('checkin_history')
    if (error) return { ok: false, error: checkInError(error) }
    return {
      ok: true,
      entries: (data as CheckInHistoryRow[]).map(row => ({
        id: row.id, at: row.created_at, action: row.action, bookingId: row.booking_id,
        referenceCode: row.reference_code, fullName: row.full_name, seatIds: row.seat_ids, adminName: row.admin_name,
      })),
    }
  } catch {
    return { ok: false, error: 'unknown' }
  }
}

// One-time "Send check-in QR codes": confirmed bookings whose QR email hasn't gone out yet
// (bookings.checkin_email_at is empty). Throws 'not_set_up' before migration 007.
export type QrEmailBooking = { id: string; referenceCode: string; fullName: string; email: string; seatIds: string[] }
// sent; already_sent: someone else sent it first (the server checks, so it's never sent twice)
export type QrEmailResult = 'sent' | 'already_sent' | 'failed'

export async function getQrEmailsToSend(): Promise<QrEmailBooking[]> {
  const { data, error } = await client()
    .from('bookings')
    .select('id, reference_code, full_name, email, seat_ids')
    .eq('status', 'approved')
    .is('checkin_email_at', null)
    .order('full_name', { ascending: true })
  // 42703: column doesn't exist (migration 007 not run)
  if (error) throw new Error(error.code === '42703' ? 'not_set_up' : error.message)
  return (data as { id: string; reference_code: string; full_name: string; email: string; seat_ids: string[] }[])
    .map(row => ({ id: row.id, referenceCode: row.reference_code, fullName: row.full_name, email: row.email, seatIds: row.seat_ids }))
}

export async function sendCheckInQrEmail(bookingId: string): Promise<QrEmailResult> {
  try {
    const { data } = await client().auth.getSession()
    const token = data.session?.access_token
    if (!token) return 'failed'
    const response = await fetch('/api/booking-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kind: 'checkin', bookingId }),
    })
    const result = await response.json() as { sent?: boolean; reason?: string }
    return result.sent === true ? 'sent' : result.reason === 'already_sent' ? 'already_sent' : 'failed'
  } catch {
    return 'failed'
  }
}

// The booking's check-in QR secret, for "Download QR code" (when an email has to be sent by hand)
export async function getCheckInToken(bookingId: string): Promise<string | null> {
  const { data, error } = await client().from('bookings').select('checkin_token').eq('id', bookingId).maybeSingle()
  if (error || !data) return null
  return (data as { checkin_token: string | null }).checkin_token
}
