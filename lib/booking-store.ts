// The only data layer. Uses Supabase when NEXT_PUBLIC_SUPABASE_URL and
// NEXT_PUBLIC_SUPABASE_ANON_KEY are set, otherwise the in-memory mock.
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { BookingInput, Seat } from './event-config'
import * as mock from './booking-store.mock'
import { supabase } from './supabase'

export type Settings = { pricePerSeat: number | null; maxSeats: number; bookingsOpen: boolean }
export type ReserveInput = Omit<BookingInput, 'proofName'> & { proof: File }
export type ReserveError = 'bookings_closed' | 'invalid_seat_count' | 'invalid_seats' | 'missing_details' | 'invalid_email' | 'missing_screenshot' | 'upload_failed' | 'unknown'
export type ReserveResult =
  | { ok: true; referenceCode: string; seats: string[]; amount: number | null }
  | { ok: false; conflicts: string[] }
  | { ok: false; error: ReserveError }

export const IS_MOCK = !supabase

const BUCKET = 'payment-screenshots'
const RPC_ERRORS: ReserveError[] = ['bookings_closed', 'invalid_seat_count', 'invalid_seats', 'missing_details', 'invalid_email', 'missing_screenshot']
// Set the type from the extension: HEIC files often have an empty file.type on Windows.
const CONTENT_TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' }
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' }

const toNumber = (value: unknown) => value === null || value === undefined ? null : Number(value)
const toSeat = ({ id, status }: { id: string; status: Seat['status'] }): Seat => {
  const [row, number] = id.split('-')
  return { id, row, number: Number(number), status }
}

let cache: Seat[] = []
const listeners = new Set<(seats: Seat[]) => void>()
let channel: RealtimeChannel | null = null
const emit = () => listeners.forEach(listener => listener(cache.map(s => ({ ...s }))))

export async function getSeats(): Promise<Seat[]> {
  if (!supabase) return mock.getSeats()
  const { data, error } = await supabase.from('seats').select('id, status')
  if (error) throw error
  cache = data.map(toSeat)
  return cache.map(s => ({ ...s }))
}

export async function getSettings(): Promise<Settings> {
  if (!supabase) return mock.getSettings()
  const { data, error } = await supabase.from('event_settings').select('price_per_seat, max_seats, bookings_open').single()
  if (error) throw error
  return { pricePerSeat: toNumber(data.price_per_seat), maxSeats: data.max_seats, bookingsOpen: data.bookings_open }
}

export function subscribe(callback: (seats: Seat[]) => void): () => void {
  if (!supabase) return mock.subscribe(callback)
  const client = supabase
  listeners.add(callback)
  if (!channel) {
    channel = client
      .channel(`seats-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'seats' }, payload => {
        const row = payload.new as { id: string; status: Seat['status'] }
        cache = cache.map(seat => seat.id === row.id ? { ...seat, status: row.status } : seat)
        emit()
      })
      // Fires on the first join and after every reconnect: refetch so missed updates are not lost.
      .subscribe(status => { if (status === 'SUBSCRIBED') getSeats().then(emit, () => {}) })
  }
  return () => {
    listeners.delete(callback)
    if (!listeners.size && channel) { client.removeChannel(channel); channel = null }
  }
}

export async function reserveSeats(input: ReserveInput): Promise<ReserveResult> {
  if (!supabase) return mock.reserveSeats(input)
  try {
    const nameExt = input.proof.name.split('.').pop()?.toLowerCase() ?? ''
    const ext = CONTENT_TYPES[nameExt] ? nameExt : EXTENSIONS[input.proof.type] ?? nameExt
    const path = `pending/${crypto.randomUUID()}.${ext}`
    const contentType = CONTENT_TYPES[ext] ?? input.proof.type
    // storage-js sends a Blob's own type and ignores the contentType option for Blobs, so re-type the file too.
    const body = input.proof.slice(0, input.proof.size, contentType)
    const upload = await supabase.storage.from(BUCKET).upload(path, body, { contentType, upsert: false })
    if (upload.error) return { ok: false, error: 'upload_failed' }

    const { data, error } = await supabase.rpc('reserve_seats', {
      p_seat_ids: input.seats,
      p_full_name: input.fullName,
      p_contact: input.contact,
      p_email: input.email,
      p_organization: input.company ?? '',
      p_notes: input.notes ?? '',
      p_screenshot_path: path,
    })
    if (error) {
      if (error.message === 'seats_unavailable') return { ok: false, conflicts: (error.details ?? '').split(',').filter(Boolean) }
      const code = RPC_ERRORS.find(known => known === error.message)
      return { ok: false, error: code ?? 'unknown' }
    }
    const result = (data as { reference_code: string; seat_ids: string[]; amount: number | string | null }[])[0]
    return { ok: true, referenceCode: result.reference_code, seats: result.seat_ids, amount: toNumber(result.amount) }
  } catch {
    return { ok: false, error: 'unknown' }
  }
}
