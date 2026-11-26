// Server only: makes the check-in QR image for the "Booking confirmed" and "Your check-in
// QR code" emails, as an inline attachment (Gmail shows cid: images, not data: images).
// Imported by app/api/booking-email and nothing else.
import QRCode from 'qrcode'
import { CHECKIN_QR_CID, checkinQrText } from './checkin-code'
import type { EmailAttachment } from './mailer'

// 440px PNG shown at 220px in the email (sharp on phone screens); margin 4 is the standard
// quiet zone scanners need; level M survives a cracked screen or glare.
export async function checkinQrAttachment(token: string): Promise<EmailAttachment> {
  const content = await QRCode.toBuffer(checkinQrText(token), { type: 'png', width: 440, margin: 4, errorCorrectionLevel: 'M' })
  return { filename: 'checkin-qr.png', content, cid: CHECKIN_QR_CID, contentType: 'image/png' }
}
