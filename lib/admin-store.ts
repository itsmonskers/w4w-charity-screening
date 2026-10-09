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
  status: BookingStatus
  reviewNote: string | null
  reviewedAt: string | null
  createdAt: string
}
export type SeatCounts = { available: number; reserved: number; taken: number }
export type SignInResult = { ok: true } | { ok: false; error: 'invalid_credentials' | 'unknown' }
export type ReviewError = 'booking_not_pending' | 'booking_not_found' | 'not_admin' | 'unknown'
export type ReviewResult = { ok: true } | { ok: false; error: ReviewError }

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
  amount: number | string | null; screenshot_path: string; status: BookingStatus
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
    .select('id, reference_code, full_name, contact, email, organization, notes, seat_ids, seat_count, amount, screenshot_path, status, review_note, reviewed_at, created_at')
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

async function review(fn: 'approve_booking' | 'reject_booking', bookingId: string, note: string): Promise<ReviewResult> {
  try {
    const { error } = await client().rpc(fn, { p_booking_id: bookingId, p_note: note.trim() || null })
    if (!error) return { ok: true }
    return { ok: false, error: REVIEW_ERRORS.find(known => known === error.message) ?? 'unknown' }
  } catch {
    return { ok: false, error: 'unknown' }
  }
}

export const approveBooking = (bookingId: string, note: string) => review('approve_booking', bookingId, note)
export const rejectBooking = (bookingId: string, note: string) => review('reject_booking', bookingId, note)
