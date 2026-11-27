// Server only: makes the check-in QR image. Imported by app/api/booking-email (the "Booking
// confirmed" and "Your check-in QR code" emails) and app/api/qr/[token] (the "Open your QR code"
// link), so both always show exactly the same QR.
import QRCode from 'qrcode'
import { CHECKIN_QR_CID, checkinQrText } from './checkin-code'
import type { EmailAttachment } from './mailer'

// 440px PNG shown at 220px in the email (sharp on phone screens); margin 4 is the standard
// quiet zone scanners need; level M survives a cracked screen or glare.
// The QR holds exactly "W4W1:" + token, so codes already sent keep working.
export const checkinQrPng = (token: string) => QRCode.toBuffer(checkinQrText(token), { type: 'png', width: 440, margin: 4, errorCorrectionLevel: 'M' })

// The same QR twice: inline in the email (Gmail shows cid: images, not data: images), and as a
// normal file the guest can save ("Movies4Water-QR-W4W-DD-7K2Q.png").
export async function checkinQrAttachments(token: string, referenceCode: string): Promise<EmailAttachment[]> {
  const content = await checkinQrPng(token)
  return [
    { filename: 'checkin-qr.png', content, cid: CHECKIN_QR_CID, contentType: 'image/png' },
    { filename: `Movies4Water-QR-${referenceCode}.png`, content, contentType: 'image/png' },
  ]
}
