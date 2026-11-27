// FAKE DATA for testing /admin on localhost only (see lib/admin-api.ts for the guard).
// Same functions and types as lib/admin-store.ts. Everything lives in memory: nothing
// is saved, no email is sent, and this file never imports the Supabase client.
// Names, emails, phone numbers, payment refs and screenshots are all invented.
import type { AdminBooking, CheckInBooking, CheckInError, CheckInLookup, CheckInResult, CheckInState, QrEmailBooking, QrEmailResult, ReviewResult, SeatCounts, SignInResult } from './admin-store'

export const ADMIN_AVAILABLE = true

const TOTAL_SEATS = 315
const PRICE = 1000
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

// Booking ids that act out special cases
const EMAIL_FAILS = ['mock-liza', 'mock-jose'] // approve/reject works, but the guest email "fails"
const QR_FAILS = ['mock-carla'] // the confirmed email "sends", but without the QR image
const HANDLED_ELSEWHERE = 'mock-rafael' // "another admin" handles it first

type Fake = Partial<AdminBooking> & Pick<AdminBooking, 'id' | 'referenceCode' | 'fullName' | 'seatIds'> & { minutesAgo: number }

const fakes: Fake[] = [
  // Waiting for review, oldest first
  { id: 'mock-ana', referenceCode: 'W4W-DD-TAN2', fullName: 'Ana Reyes', seatIds: ['L-7', 'L-8'], minutesAgo: 3 * 24 * 60, organization: 'Example Org', payerName: 'Ana Reyes', foodAllergies: 'Peanuts\nShellfish', notes: 'Fake note: please seat us together.' },
  { id: 'mock-miguel', referenceCode: 'W4W-DD-TMG3', fullName: 'Miguel Santos', seatIds: ['F-3', 'F-4', 'G-5', 'G-6'], minutesAgo: 2 * 24 * 60, payerName: 'M Santos' },
  { id: 'mock-carla', referenceCode: 'W4W-DD-TCD4', fullName: 'Carla Dizon', seatIds: ['Q-10'], minutesAgo: 26 * 60 },
  { id: 'mock-jose', referenceCode: 'W4W-DD-TJR5', fullName: 'Jose Ramos', seatIds: ['B-12', 'B-13'], minutesAgo: 20 * 60, amount: null },
  { id: 'mock-bea', referenceCode: 'W4W-DD-TBV6', fullName: 'Bea Villanueva', seatIds: ['H-9'], minutesAgo: 6 * 60, screenshotPath: 'pending/mock-bea.heic' },
  { id: 'mock-paolo', referenceCode: 'W4W-DD-TPG7', fullName: 'Paolo Garcia', seatIds: ['M-2', 'M-3', 'M-4'], minutesAgo: 3 * 60, screenshotPath: 'pending/mock-missing.png' },
  { id: 'mock-liza', referenceCode: 'W4W-DD-TLM8', fullName: 'Liza Mendoza', seatIds: ['D-20'], minutesAgo: 60, payerName: 'Liza Mendoza' },
  { id: HANDLED_ELSEWHERE, referenceCode: 'W4W-DD-TRC9', fullName: 'Rafael Cruz', seatIds: ['O-14', 'O-15'], minutesAgo: 20 },
  // Confirmed
  { id: 'mock-nina', referenceCode: 'W4W-DD-TNB2', fullName: 'Nina Bautista', seatIds: ['J-7', 'J-8'], minutesAgo: 5 * 24 * 60, status: 'approved', reviewedAt: ago(4 * 24 * 60), payerName: 'Nina Bautista' },
  { id: 'mock-marco', referenceCode: 'W4W-DD-TML3', fullName: 'Marco Lim', seatIds: ['A-11'], minutesAgo: 4 * 24 * 60, status: 'approved', reviewedAt: ago(3 * 24 * 60), reviewNote: 'Fake note: paid in two parts.' },
  { id: 'mock-grace', referenceCode: 'W4W-DD-TGT4', fullName: 'Grace Tan', seatIds: ['P-1', 'P-2', 'P-3'], minutesAgo: 4 * 24 * 60, status: 'approved', reviewedAt: ago(2 * 24 * 60) },
  // Not approved
  { id: 'mock-ken', referenceCode: 'W4W-DD-TKA5', fullName: 'Ken Aquino', seatIds: ['C-5'], minutesAgo: 6 * 24 * 60, status: 'rejected', reviewedAt: ago(5 * 24 * 60), reviewNote: 'Fake reason: no matching payment found.' },
  { id: 'mock-joy', referenceCode: 'W4W-DD-TJN6', fullName: 'Joy Navarro', seatIds: ['K-3', 'K-4'], minutesAgo: 3 * 24 * 60, status: 'rejected', reviewedAt: ago(2 * 24 * 60), reviewNote: 'Fake reason: amount was different.' },
]

const bookings: AdminBooking[] = fakes.map((fake, i) => {
  const first = fake.fullName.split(' ')[0].toLowerCase()
  return {
    contact: `+63 900 000 ${String(i + 1).padStart(4, '0')}`,
    email: `${first}@example.com`,
    organization: null,
    notes: null,
    seatCount: fake.seatIds.length,
    amount: fake.amount === null ? null : fake.seatIds.length * PRICE,
    screenshotPath: `pending/${fake.id}.png`,
    paymentRef: `TEST${String(482130 + i * 7)}`,
    payerName: null,
    foodAllergies: null,
    status: 'pending',
    reviewNote: null,
    reviewedAt: null,
    createdAt: ago(fake.minutesAgo),
    ...fake,
  }
})

// Sign-in: any email with any password except "wrong"; emails starting with
// "notadmin" sign in but are not admins.
let signedInEmail: string | null = null
const authListeners = new Set<(email: string | null) => void>()
const notifyAuth = () => authListeners.forEach(listener => listener(signedInEmail))

export async function signIn(email: string, password: string): Promise<SignInResult> {
  await delay(400)
  if (password === 'wrong') return { ok: false, error: 'invalid_credentials' }
  signedInEmail = email.trim()
  notifyAuth()
  return { ok: true }
}

export async function signOut() {
  await delay(100)
  signedInEmail = null
  notifyAuth()
}

export function onAuthChange(callback: (email: string | null) => void): () => void {
  authListeners.add(callback)
  setTimeout(() => { if (authListeners.has(callback)) callback(signedInEmail) }, 0)
  return () => { authListeners.delete(callback) }
}

export async function checkIsAdmin(): Promise<boolean> {
  await delay(200)
  return !!signedInEmail && !signedInEmail.toLowerCase().startsWith('notadmin')
}

export async function getSeatCounts(): Promise<SeatCounts> {
  await delay(200)
  const seats = (status: AdminBooking['status']) => bookings.filter(b => b.status === status).reduce((sum, b) => sum + b.seatCount, 0)
  const reserved = seats('pending')
  const taken = seats('approved')
  return { available: TOTAL_SEATS - reserved - taken, reserved, taken }
}

// Test hooks, registered on the first fake load (so they never exist in real mode):
// - `window.dispatchEvent(new Event('admin-mock:new-booking'))` adds a fake guest who "just
//   booked", to test bookings arriving during a check.
// - `window.dispatchEvent(new Event('admin-mock:fail-next-review'))` makes the next approve or
//   reject fail with an unknown error (like a lost connection); nothing changes.
// - `window.dispatchEvent(new CustomEvent('admin-mock:handle-elsewhere', { detail: 'mock-ana' }))`
//   confirms a waiting booking as if another admin did it (shows on the next refresh).
// Every load is logged ("[admin mock] getBookings" with the time) to test the auto-refresh.
let newBookingHook = false
let failNextReview = false
function listenForNewBookings() {
  if (newBookingHook || typeof window === 'undefined') return
  newBookingHook = true
  window.addEventListener('admin-mock:fail-next-review', () => { failNextReview = true })
  window.addEventListener('admin-mock:handle-elsewhere', event => {
    const booking = bookings.find(b => b.id === (event as CustomEvent<string>).detail)
    if (booking?.status === 'pending') {
      Object.assign(booking, { status: 'approved', reviewNote: 'Fake: handled by another admin', reviewedAt: new Date().toISOString() })
      addTickets(booking)
    }
  })
  window.addEventListener('admin-mock:new-booking', () => {
    const n = bookings.length + 1
    bookings.push({ id: `mock-new-${n}`, referenceCode: `W4W-DD-TNW${n}`, fullName: 'Sofia Torres', contact: '+63 900 000 9999', email: 'sofia@example.com', organization: null, notes: null, seatIds: ['N-1'], seatCount: 1, amount: PRICE, screenshotPath: `pending/mock-new-${n}.png`, paymentRef: `TEST9${n}0000`, payerName: 'Sofia Torres', foodAllergies: null, status: 'pending', reviewNote: null, reviewedAt: null, createdAt: new Date().toISOString() })
  })
}

export async function getBookings(): Promise<AdminBooking[]> {
  listenForNewBookings()
  console.info('[admin mock] getBookings', JSON.stringify({ at: Date.now() }))
  await delay(300)
  return bookings.map(b => ({ ...b, seatIds: [...b.seatIds] })).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

// A plain invented receipt, drawn in code (no bank branding), clearly marked FAKE.
function fakeReceipt(booking: AdminBooking) {
  const amount = booking.amount === null ? 'PRICE TBD' : `PHP ${booking.amount.toLocaleString('en-PH')}.00`
  const lines = [['Amount', amount], ['Reference', booking.paymentRef ?? '–'], ['From', booking.payerName ?? booking.fullName], ['To', 'Test Account']]
  const text = lines.map(([label, value], i) => `<text x="24" y="${150 + i * 64}" font-size="16" fill="#d64545">${label}</text><text x="24" y="${176 + i * 64}" font-size="22" font-weight="700" fill="#d64545">${value}</text>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640" viewBox="0 0 360 640" font-family="Arial, sans-serif"><rect width="360" height="640" fill="#fff"/><rect width="360" height="96" fill="#d64545"/><text x="24" y="44" font-size="24" font-weight="700" fill="#fff">FAKE RECEIPT</text><text x="24" y="74" font-size="14" fill="#fff">Test data only, not a real payment</text>${text}<text x="180" y="560" font-size="56" font-weight="700" fill="#d64545" fill-opacity=".18" text-anchor="middle" transform="rotate(-30 180 560)">FAKE</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export async function getScreenshotUrl(path: string, download = false): Promise<string | null> {
  void download
  await delay(250)
  const booking = bookings.find(b => b.screenshotPath === path)
  if (!booking || path.includes('missing')) return null
  return fakeReceipt(booking)
}

// Logged so tests can check exactly which "database" call the screen made.
// receipt: the AR picked in the confirm step. Nothing is sent; logged (name, size, type) so tests
// can check it arrived, and "sending" takes a little longer, like a real upload.
async function review(fn: 'approve_booking' | 'reject_booking', bookingId: string, note: string, receipt?: File): Promise<ReviewResult> {
  console.info(`[admin mock] ${fn}`, JSON.stringify({ p_booking_id: bookingId, p_note: note.trim() || null }))
  if (receipt) console.info('[admin mock] confirmed email with AR', JSON.stringify({ name: receipt.name, size: receipt.size, type: receipt.type }))
  await delay(receipt ? 1500 : 600)
  if (failNextReview) { failNextReview = false; return { ok: false, error: 'unknown' } }
  const booking = bookings.find(b => b.id === bookingId)
  if (!booking) return { ok: false, error: 'booking_not_found' }
  if (bookingId === HANDLED_ELSEWHERE && booking.status === 'pending') {
    Object.assign(booking, { status: 'approved', reviewNote: 'Fake: handled by another admin', reviewedAt: new Date().toISOString() })
    addTickets(booking)
  }
  if (booking.status !== 'pending') return { ok: false, error: 'booking_not_pending' }
  Object.assign(booking, { status: fn === 'approve_booking' ? 'approved' : 'rejected', reviewNote: note.trim() || null, reviewedAt: new Date().toISOString() })
  // Like approve_booking: one ticket per seat, ready for check-in
  if (fn === 'approve_booking') addTickets(booking)
  const emailSent = !EMAIL_FAILS.includes(bookingId)
  // Like the server: sent without the QR image, so it isn't the QR email (stays on Send check-in QR codes)
  if (fn === 'approve_booking' && emailSent && QR_FAILS.includes(bookingId)) return { ok: true, emailSent, withoutQr: true }
  // The "Booking confirmed" email carries the check-in QR, so it counts as the QR email
  if (fn === 'approve_booking' && emailSent) qrEmailed.add(bookingId)
  return { ok: true, emailSent }
}

export const approveBooking = (bookingId: string, note: string, receipt?: File) => review('approve_booking', bookingId, note, receipt)
export const rejectBooking = (bookingId: string, note: string) => review('reject_booking', bookingId, note)

// ---------------------------------------------------------------------------
// Event-day check-in (fake). Each fake booking's QR token is its position in the list above
// (1-based) as two hex digits, repeated 32 times: Ana = "01" × 32, Nina = "09" × 32,
// Marco = "0a" × 32, Grace = "0b" × 32, Ken (not approved) = "0c" × 32. The QR text is
// "W4W1:" + token. Confirmed bookings get one ticket per seat, like approve_booking.
// Test hooks (registered on the first fake load, so never in real mode):
// - `window.dispatchEvent(new CustomEvent('admin-mock:checked-in-elsewhere', { detail: { bookingId: 'mock-grace', seatIds: ['P-1'] } }))`
//   checks seats in as if another staff member did it (seatIds optional: all seats).
// - `window.dispatchEvent(new Event('admin-mock:fail-next-checkin'))`: the next lookup,
//   check-in or undo fails with an unknown error (like a lost connection); nothing changes.
// - `window.dispatchEvent(new Event('admin-mock:not-set-up'))`: check-in acts as if
//   migration 007 hasn't been run (until reload).
// ---------------------------------------------------------------------------

const OTHER_STAFF = 'Jenna (fake)'
type FakeTicket = { seatId: string; checkedInAt: string | null; checkedInBy: string | null }
const tokens = new Map(bookings.map((b, i) => [b.id, (i + 1).toString(16).padStart(2, '0').repeat(32)]))
const tickets = new Map<string, FakeTicket[]>()
function addTickets(booking: AdminBooking) {
  if (!tickets.has(booking.id)) tickets.set(booking.id, booking.seatIds.map(seatId => ({ seatId, checkedInAt: null, checkedInBy: null })))
}
bookings.filter(b => b.status === 'approved').forEach(addTickets)

let failNextCheckIn = false
let notSetUp = false
let checkInHooks = false
function listenForCheckInHooks() {
  if (checkInHooks || typeof window === 'undefined') return
  checkInHooks = true
  window.addEventListener('admin-mock:fail-next-checkin', () => { failNextCheckIn = true })
  window.addEventListener('admin-mock:not-set-up', () => { notSetUp = true })
  window.addEventListener('admin-mock:checked-in-elsewhere', event => {
    const { bookingId, seatIds } = (event as CustomEvent<{ bookingId: string; seatIds?: string[] }>).detail
    const now = new Date().toISOString()
    for (const t of tickets.get(bookingId) ?? []) {
      if (!t.checkedInAt && (!seatIds || seatIds.includes(t.seatId))) Object.assign(t, { checkedInAt: now, checkedInBy: OTHER_STAFF })
    }
  })
}

// A failure set by a test hook, or null to carry on
function checkInTrouble(): CheckInError | null {
  listenForCheckInHooks()
  if (notSetUp) return 'not_set_up'
  if (failNextCheckIn) { failNextCheckIn = false; return 'unknown' }
  return null
}

const details = (booking: AdminBooking): CheckInBooking => ({
  bookingId: booking.id,
  referenceCode: booking.referenceCode,
  fullName: booking.fullName,
  status: booking.status,
  foodAllergies: booking.foodAllergies,
  seatIds: [...booking.seatIds],
  seats: (tickets.get(booking.id) ?? []).map(t => ({ ...t })),
})

export async function getCheckInState(): Promise<CheckInState> {
  listenForCheckInHooks()
  await delay(200)
  const state: CheckInState = { total: 0, arrived: 0, bookings: {} }
  for (const [bookingId, list] of tickets) {
    const arrived = list.filter(t => t.checkedInAt)
    const lastAt = arrived.reduce<string | null>((latest, t) => !latest || t.checkedInAt! > latest ? t.checkedInAt : latest, null)
    state.bookings[bookingId] = { seats: list.length, arrived: arrived.length, lastAt }
    state.total += list.length
    state.arrived += arrived.length
  }
  return state
}

async function fakeLookup(find: () => AdminBooking | undefined, log: string): Promise<CheckInLookup> {
  console.info(`[admin mock] ${log}`)
  await delay(300)
  const trouble = checkInTrouble()
  if (trouble) return { ok: false, error: trouble }
  const booking = find()
  return { ok: true, booking: booking ? details(booking) : null }
}

export const lookupCheckIn = (token: string) => fakeLookup(() => bookings.find(b => tokens.get(b.id) === token.trim().toLowerCase()), `checkin_lookup ${JSON.stringify({ p_token: token })}`)
export const getCheckInBooking = (bookingId: string) => fakeLookup(() => bookings.find(b => b.id === bookingId), `checkin_booking ${JSON.stringify({ p_booking_id: bookingId })}`)

// Same rules as check_in_seats / undo_check_in: confirmed only, seats must belong to the
// booking, and only seats in the other state change
async function fakeChange(fn: 'check_in_seats' | 'undo_check_in', bookingId: string, seatIds: string[]): Promise<CheckInResult> {
  console.info(`[admin mock] ${fn}`, JSON.stringify({ p_booking_id: bookingId, p_seat_ids: seatIds }))
  await delay(500)
  const trouble = checkInTrouble()
  if (trouble) return { ok: false, error: trouble }
  const booking = bookings.find(b => b.id === bookingId)
  if (!booking) return { ok: false, error: 'booking_not_found' }
  if (fn === 'check_in_seats' && booking.status !== 'approved') return { ok: false, error: 'booking_not_confirmed' }
  if (!seatIds.length || !seatIds.every(id => booking.seatIds.includes(id))) return { ok: false, error: 'invalid_seats' }
  const now = new Date().toISOString()
  const changed: string[] = []
  for (const t of tickets.get(bookingId) ?? []) {
    if (!seatIds.includes(t.seatId)) continue
    if (fn === 'check_in_seats' && !t.checkedInAt) { Object.assign(t, { checkedInAt: now, checkedInBy: signedInEmail ?? 'you' }); changed.push(t.seatId) }
    if (fn === 'undo_check_in' && t.checkedInAt) { Object.assign(t, { checkedInAt: null, checkedInBy: null }); changed.push(t.seatId) }
  }
  return { ok: true, changed, booking: details(booking) }
}

export const checkInSeats = (bookingId: string, seatIds: string[]) => fakeChange('check_in_seats', bookingId, seatIds)
export const undoCheckIn = (bookingId: string, seatIds: string[]) => fakeChange('undo_check_in', bookingId, seatIds)

// One-time "Send check-in QR codes" (fake: nothing is sent). The confirmed fakes start without
// it, like the 2 live bookings confirmed before the QR existed. Marco's first send "fails"
// (to test Retry). Test hook: `window.dispatchEvent(new CustomEvent('admin-mock:qr-sent-elsewhere',
// { detail: 'mock-nina' }))` marks one as sent by another admin (the next send says "already sent").
const QR_FAILS_ONCE = new Set(['mock-marco'])
const qrEmailed = new Set<string>()
let qrHooks = false
function listenForQrHooks() {
  if (qrHooks || typeof window === 'undefined') return
  qrHooks = true
  window.addEventListener('admin-mock:qr-sent-elsewhere', event => { qrEmailed.add((event as CustomEvent<string>).detail) })
}

export async function getQrEmailsToSend(): Promise<QrEmailBooking[]> {
  listenForQrHooks()
  await delay(300)
  if (notSetUp) throw new Error('not_set_up')
  return bookings.filter(b => b.status === 'approved' && !qrEmailed.has(b.id))
    .map(b => ({ id: b.id, referenceCode: b.referenceCode, fullName: b.fullName, email: b.email, seatIds: [...b.seatIds] }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
}

// Same rules as the email route: confirmed only, once per booking
export async function sendCheckInQrEmail(bookingId: string): Promise<QrEmailResult> {
  console.info('[admin mock] send checkin email', JSON.stringify({ bookingId }))
  await delay(700)
  const booking = bookings.find(b => b.id === bookingId)
  if (!booking || booking.status !== 'approved') return 'failed'
  if (qrEmailed.has(bookingId)) return 'already_sent'
  if (QR_FAILS_ONCE.delete(bookingId)) return 'failed'
  qrEmailed.add(bookingId)
  return 'sent'
}

export async function getCheckInToken(bookingId: string): Promise<string | null> {
  await delay(150)
  return notSetUp ? null : tokens.get(bookingId) ?? null
}
