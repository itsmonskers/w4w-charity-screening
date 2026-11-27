// Display helpers for /admin. No data access: everything here works on bookings already loaded.
import type { AdminBooking } from '@/lib/admin-api'
import { formatPrice } from '@/lib/event-config'

export const manilaTime = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })
const manilaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' })
const manilaShortDay = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })
// "Nov 21" (Manila time), for list rows
export const manilaDay = (iso: string) => manilaShortDay.format(new Date(iso))
export const formatTime = (iso: string) => `${manilaTime.format(new Date(iso))} (Manila)`
const manilaClockFormat = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })
// "4:02 PM" (Manila), for check-in times on the day
export const manilaClock = (iso: string) => manilaClockFormat.format(new Date(iso))
// Seat ids in row order, then seat number: L-7, L-8, M-2
export const sortSeats = (seats: string[]) => [...seats].sort((a, b) => {
  const [rowA, numA] = a.split('-'), [rowB, numB] = b.split('-')
  return rowA.localeCompare(rowB) || Number(numA) - Number(numB)
})
export const seatLabel = (count: number) => `${count} seat${count === 1 ? '' : 's'}`

// "Row L · Seats 7, 8, 9", one line per row, rows and seats ascending (same format as the e-ticket)
export function seatsByRow(seats: string[]) {
  const rows = new Map<string, number[]>()
  for (const id of seats) {
    const [row, number] = id.split('-')
    rows.set(row, [...(rows.get(row) ?? []), Number(number)])
  }
  return [...rows].sort(([a], [b]) => a.localeCompare(b)).map(([row, numbers]) => {
    numbers.sort((a, b) => a - b)
    return `Row ${row} · Seat${numbers.length === 1 ? '' : 's'} ${numbers.join(', ')}`
  })
}

export function approvedTotal(bookings: AdminBooking[]) {
  const approved = bookings.filter(b => b.status === 'approved')
  const unpriced = approved.filter(b => b.amount === null).length
  if (approved.length && unpriced === approved.length) return formatPrice(null)
  const sum = approved.reduce((total, b) => total + (b.amount ?? 0), 0)
  return unpriced ? `${formatPrice(sum)} + ${unpriced} at [PRICE TBD]` : formatPrice(sum)
}

// Quote every cell; neutralise spreadsheet formulas but keep phone numbers like +63 917 … as they are.
function csvCell(value: string) {
  const formula = /^[=@\t\r]/.test(value) || (/^[+-]/.test(value) && !/^[+-][\d\s()-]*$/.test(value))
  return `"${(formula ? `'${value}` : value).replace(/"/g, '""')}"`
}

export function exportApproved(bookings: AdminBooking[]) {
  const header = ['Reference code', 'Name', 'Contact', 'Email', 'Seats', 'Seat count', 'Amount', 'Payment ref', 'Paid by', 'Food allergies']
  const rows = bookings
    .filter(b => b.status === 'approved')
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map(b => [b.referenceCode, b.fullName, b.contact, b.email, seatsByRow(b.seatIds).join('; '), String(b.seatCount), b.amount === null ? '[PRICE TBD]' : String(b.amount), b.paymentRef ?? '', b.payerName ?? '', (b.foodAllergies ?? '').replace(/\s*\r?\n\s*/g, '; ')])
  // BOM so Excel reads ₱ and · correctly
  const csv = '﻿' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `w4w-doomsday-approved-${manilaDate.format(new Date())}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Search: name, payer name, phone, email, booking code or payment ref. Phone numbers and
// payment refs also match without spaces or dashes ("0900 000" finds "+63 900 000 …").
const compact = (value: string) => value.toLowerCase().replace(/[\s()+-]/g, '')
export function matchesSearch(booking: AdminBooking, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const fields = [booking.fullName, booking.payerName ?? '', booking.contact, booking.email, booking.referenceCode, booking.paymentRef ?? '']
  const qc = compact(q)
  return fields.some(value => value.toLowerCase().includes(q) || (!!qc && compact(value).includes(qc)))
}

// "3 days", "5 hours", "20 minutes": how long ago a booking came in
export function waitingFor(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'less than a minute'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}
