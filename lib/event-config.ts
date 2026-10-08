export const MAX_SEATS = 10
export const PRICE_PER_SEAT: number | null = null
export const EVENT = { film: 'Avengers: Doomsday', date: 'Saturday, December 19, 2026', venue: '[VENUE TBD]', time: 'Doors 3:30 PM · Movie 4:00 PM' }
export const formatPrice = (amount: number | null) => amount === null ? '₱[PRICE TBD]' : `₱${amount.toLocaleString('en-PH')}`

export type BookingInput = { seats: string[]; fullName: string; contact: string; email: string; company?: string; notes?: string; proofName: string }
export type Seat = { id: string; row: string; number: number; status: 'available' | 'reserved' | 'taken' }
export type BookingResult = { ok: true; referenceCode: string } | { ok: false; conflicts: string[] }

export const eventTotal = (count: number) => PRICE_PER_SEAT === null ? '₱[PRICE TBD]' : formatPrice(PRICE_PER_SEAT * count)
