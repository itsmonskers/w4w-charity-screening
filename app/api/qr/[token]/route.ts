// "Open your QR code" link in the confirmed and check-in QR emails: the guest's check-in QR as a
// PNG, shown in the browser (press and hold to save). The token in the link is the same secret
// the QR already carries, so the link exposes nothing the email doesn't.
// - No database lookup: any 64-character 0-9/a-f token gets a QR, so the route can't tell anyone
//   which tokens are real (a made-up token's QR checks nobody in).
// - Never logs the URL or the token.
// - Cached for a year: the same token always gives the same image.
import { checkinQrPng } from '@/lib/checkin-qr'

export const runtime = 'nodejs'

const TOKEN = /^[0-9a-f]{64}$/
const NOINDEX = { 'X-Robots-Tag': 'noindex' }

const message = (status: number) => new Response('Show your reference code at the entrance.', {
  status,
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...NOINDEX },
})

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!TOKEN.test(token)) return message(400)
  let png: Buffer
  try {
    png = await checkinQrPng(token)
  } catch {
    return message(500)
  }
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': 'inline; filename="Movies4Water-QR.png"',
      'Cache-Control': 'public, max-age=31536000, immutable',
      ...NOINDEX,
    },
  })
}
