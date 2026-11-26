// The text inside a check-in QR code: "W4W1:" + the booking's 64-character secret token
// (bookings.checkin_token, migration 007). The prefix lets the scanner turn away any other
// QR code (a payment QR, a website) straight away, without asking the database.
// No data access here; used by the email (server), the scanner and the admin QR download.
export const CHECKIN_QR_PREFIX = 'W4W1:'

const TOKEN = /^[0-9a-f]{64}$/

export const checkinQrText = (token: string) => `${CHECKIN_QR_PREFIX}${token}`

// The token from a scanned code, or null when it isn't one of our check-in codes
export function tokenFromQr(text: string): string | null {
  const value = text.trim()
  if (!value.startsWith(CHECKIN_QR_PREFIX)) return null
  const token = value.slice(CHECKIN_QR_PREFIX.length).toLowerCase()
  return TOKEN.test(token) ? token : null
}
