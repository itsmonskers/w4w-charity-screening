'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { getCheckInToken } from '@/lib/admin-api'
import { checkinQrText } from '@/lib/checkin-code'

// "Download QR code": the guest's check-in QR as a PNG, to attach to an email sent by hand
// (the copied email text can't carry the image). Same image as the automatic email.
// The QR library loads only when this is pressed.
export function QrDownloadButton({ bookingId, reference, guest }: { bookingId: string; reference: string; guest: string }) {
  const [status, setStatus] = useState<'idle' | 'busy' | 'failed'>('idle')

  async function download() {
    setStatus('busy')
    try {
      const token = await getCheckInToken(bookingId)
      if (!token) return setStatus('failed')
      const { default: QRCode } = await import('qrcode')
      const link = document.createElement('a')
      link.href = await QRCode.toDataURL(checkinQrText(token), { width: 440, margin: 4, errorCorrectionLevel: 'M' })
      link.download = `checkin-qr-${reference}.png`
      link.click()
      setStatus('idle')
    } catch {
      setStatus('failed')
    }
  }

  return <>
    <button className="btn-ghost admin-btn-small" type="button" onClick={download} disabled={status === 'busy'} aria-label={`Download the check-in QR code for ${guest}`}>
      <Download size={16} aria-hidden />{status === 'busy' ? 'Preparing…' : 'Download QR code'}
    </button>
    {status === 'failed' && <span className="admin-qr-failed" role="alert">Couldn’t make the QR code. Ask the team lead.</span>}
  </>
}
