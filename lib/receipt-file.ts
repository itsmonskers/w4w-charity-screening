// The Acknowledgment Receipt (AR) an admin can attach when confirming a booking. It goes with
// the "Booking confirmed" email and is never stored. Used by the confirm step (instant check in
// the browser) and app/api/booking-email (the real check, from the file's contents).
// No data access here.

// 3 MB: Netlify's 6 MB request limit shrinks to ~4.5 MB for files, so this leaves room.
export const RECEIPT_MAX_BYTES = 3 * 1024 * 1024
export const RECEIPT_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'

export type ReceiptType = { ext: 'pdf' | 'jpg' | 'png'; contentType: string }

const SIGNATURES: [number[], ReceiptType][] = [
  [[0x25, 0x50, 0x44, 0x46, 0x2d], { ext: 'pdf', contentType: 'application/pdf' }], // %PDF-
  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], { ext: 'png', contentType: 'image/png' }],
  [[0xff, 0xd8, 0xff], { ext: 'jpg', contentType: 'image/jpeg' }],
]

// What the file really is, from its first bytes (not its name): PDF, PNG, JPG, or null
export function receiptType(head: Uint8Array): ReceiptType | null {
  return SIGNATURES.find(([bytes]) => bytes.every((byte, i) => head[i] === byte))?.[1] ?? null
}

// The attachment's name in the email, e.g. "Movies4Water-AR-W4W-DD-7K2Q.pdf"
export const receiptFilename = (referenceCode: string, type: ReceiptType) => `Movies4Water-AR-${referenceCode}.${type.ext}`

export const formatFileSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

// Problem with a picked file, in words for the admin; null when it's fine
export async function receiptProblem(file: Blob): Promise<'too_big' | 'wrong_type' | null> {
  if (file.size > RECEIPT_MAX_BYTES) return 'too_big'
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  return receiptType(head) ? null : 'wrong_type'
}
