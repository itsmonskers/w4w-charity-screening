import type { BookingInput, BookingResult, Seat } from './event-config'

const seats: Seat[] = []
const reserved = new Set(['A-22', 'B-16', 'D-8', 'G-15', 'J-5', 'M-1', 'O-21', 'Q-7'])
const taken = new Set(['A-20', 'C-12', 'F-1', 'H-11', 'K-4', 'P-15', 'Q-1'])
for (const row of 'ABCDEFGHIJKLMNOPQ') {
  const max = 'ABCDEF'.includes(row) ? 22 : 'GHIJKLMN'.includes(row) ? 15 : 21
  for (let n = max; n >= 1; n--) {
    const id = `${row}-${n}`
    seats.push({ id, row, number: n, status: taken.has(id) ? 'taken' : reserved.has(id) ? 'reserved' : 'available' })
  }
}
const listeners = new Set<(seats: Seat[]) => void>()
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
export async function getSeats() { await delay(180); return seats.map(s => ({ ...s })) }
export function subscribe(callback: (seats: Seat[]) => void) { listeners.add(callback); return () => { listeners.delete(callback) } }
export async function reserveSeats(input: BookingInput): Promise<BookingResult> {
  await delay(1000)
  const conflicts = input.seats.filter(id => seats.find(s => s.id === id)?.status !== 'available')
  if (conflicts.length) return { ok: false, conflicts }
  input.seats.forEach(id => { const seat = seats.find(s => s.id === id); if (seat) seat.status = 'reserved' })
  listeners.forEach(listener => listener(seats.map(s => ({ ...s }))))
  return { ok: true, referenceCode: `W4W-DD-${Math.random().toString(36).slice(2, 6).toUpperCase()}` }
}
