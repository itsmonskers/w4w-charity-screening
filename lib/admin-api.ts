// What /admin screens import. Normally every call goes straight to the real store
// (lib/admin-store.ts), unchanged. With NEXT_PUBLIC_ADMIN_MOCK=true it uses the FAKE
// DATA store instead, but only on localhost / 127.0.0.1 AND only while the Supabase
// settings are blank. Anywhere else, test mode refuses: every call throws and
// AdminModeGate shows an error. It never falls back to the real store.
import * as real from './admin-store'
import * as mock from './admin-store.mock'
import { supabase } from './supabase'

export type { AdminBooking, BookingStatus, CheckInBooking, CheckInError, CheckInLookup, CheckInResult, CheckInSeat, CheckInState, ReviewError, ReviewResult, SeatCounts, SignInResult } from './admin-store'

// Inlined at build time, so a normal build always takes the real path.
export const MOCK_REQUESTED = process.env.NEXT_PUBLIC_ADMIN_MOCK === 'true'
const LOCAL_HOSTS = ['localhost', '127.0.0.1']

export type AdminMode = { kind: 'real' } | { kind: 'mock' } | { kind: 'blocked'; reason: string }

// Browser only when test mode is requested (needs the page's hostname).
export function getAdminMode(): AdminMode {
  if (!MOCK_REQUESTED) return { kind: 'real' }
  if (typeof window === 'undefined') return { kind: 'blocked', reason: 'Test mode can only be checked in the browser.' }
  const host = window.location.hostname
  if (!LOCAL_HOSTS.includes(host)) return { kind: 'blocked', reason: `Test mode only runs on localhost or 127.0.0.1. This address (${host}) is not allowed, so nothing will load.` }
  if (supabase) return { kind: 'blocked', reason: 'Test mode needs the Supabase settings (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY) to be blank, so it can never reach the live database. Start it with those two set to empty.' }
  return { kind: 'mock' }
}

function store(): typeof real {
  if (!MOCK_REQUESTED) return real
  const mode = getAdminMode()
  if (mode.kind !== 'mock') throw new Error(`Admin test mode refused: ${mode.kind === 'blocked' ? mode.reason : ''}`)
  return mock
}

// Test mode reports "available" so the screens reach AdminModeGate's checks instead of the Supabase notice.
export const ADMIN_AVAILABLE = MOCK_REQUESTED || real.ADMIN_AVAILABLE
export const signIn: typeof real.signIn = (...args) => store().signIn(...args)
export const signOut: typeof real.signOut = () => store().signOut()
export const onAuthChange: typeof real.onAuthChange = (...args) => store().onAuthChange(...args)
export const checkIsAdmin: typeof real.checkIsAdmin = () => store().checkIsAdmin()
export const getSeatCounts: typeof real.getSeatCounts = () => store().getSeatCounts()
export const getBookings: typeof real.getBookings = () => store().getBookings()
export const getScreenshotUrl: typeof real.getScreenshotUrl = (...args) => store().getScreenshotUrl(...args)
export const approveBooking: typeof real.approveBooking = (...args) => store().approveBooking(...args)
export const rejectBooking: typeof real.rejectBooking = (...args) => store().rejectBooking(...args)
// Event-day check-in
export const getCheckInState: typeof real.getCheckInState = () => store().getCheckInState()
export const lookupCheckIn: typeof real.lookupCheckIn = (...args) => store().lookupCheckIn(...args)
export const getCheckInBooking: typeof real.getCheckInBooking = (...args) => store().getCheckInBooking(...args)
export const checkInSeats: typeof real.checkInSeats = (...args) => store().checkInSeats(...args)
export const undoCheckIn: typeof real.undoCheckIn = (...args) => store().undoCheckIn(...args)
