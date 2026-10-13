// Link preview (Facebook, Messenger, etc.): the W4W logo + event title on charcoal. Generated at build.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { EVENT } from '@/lib/event-config'

export const alt = 'Waves for Water Philippines · Movies4Water - Avengers: Doomsday Block Screening'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// next/og can't read CSS variables. These mirror --char and --muted-dark in app/globals.css
// (documented exception in DESIGN.md Section 0); keep them in sync.
const CHAR = '#161b20'
const MUTED_DARK = '#a9b5bf'

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), 'public/w4w-logo.png'))
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40, background: CHAR, color: '#fff' }}>
      {/* 542×480 source, shown at half size */}
      <img src={logoSrc} width={271} height={240} alt="" />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 56, fontWeight: 700 }}>Movies4Water</div>
        <div style={{ fontSize: 36 }}>{`${EVENT.film} Block Screening`}</div>
        <div style={{ fontSize: 26, color: MUTED_DARK }}>{`${EVENT.date} · Cinema 7, ${EVENT.venue}`}</div>
      </div>
    </div>,
    size,
  )
}
