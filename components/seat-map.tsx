'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getSeats, subscribe } from '@/lib/booking-store'
import { seatLayout } from '@/lib/seat-layout'
import type { Seat } from '@/lib/event-config'
import { MAX_SEATS } from '@/lib/event-config'

export function SeatMap({ selected, onChange, submitting = false, occupancy = 0 }: { selected: string[]; onChange: (ids: string[]) => void; submitting?: boolean; occupancy?: number }) {
  const [seats, setSeats] = useState<Seat[]>([])
  const [popped, setPopped] = useState('')
  const [notice, setNotice] = useState('')
  const latest = useRef({ selected, onChange, submitting })
  useEffect(() => { latest.current = { selected, onChange, submitting } })
  // While our own booking is in flight, its seats turning reserved is not someone else taking them.
  useEffect(() => { getSeats().then(setSeats); return subscribe(next => { const { selected, onChange, submitting } = latest.current; const unavailable = submitting ? [] : selected.filter(id => next.find(s => s.id === id)?.status !== 'available'); if (unavailable.length) { onChange(selected.filter(id => !unavailable.includes(id))); setNotice(`${unavailable.join(', ')} is no longer available.`) }; setSeats(next) }) }, [])
  const wrapRef = useRef<HTMLDivElement>(null)
  // Mobile: start with the middle block centred (beside the pinned row letters) so the screen and its label are in view
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !window.matchMedia('(max-width: 700px)').matches) return
    const [start, nums] = Object.values(seatLayout)[0][1]
    const cols = wrap.querySelector('.seat-grid')?.children
    const label = wrap.querySelector('.row-label')
    if (!cols || !label) return
    const box = wrap.getBoundingClientRect()
    const middle = (cols[start - 1].getBoundingClientRect().left + cols[start + nums.length - 2].getBoundingClientRect().right) / 2
    wrap.scrollLeft += middle - (label.getBoundingClientRect().right + box.right) / 2
  }, [])
  const byId = useMemo(() => new Map(seats.map(s => [s.id, s])), [seats])
  const toggle = (id: string) => { const next = selected.includes(id) ? selected.filter(s => s !== id) : selected.length < MAX_SEATS ? [...selected, id] : selected; onChange(next); setPopped(id); window.setTimeout(() => setPopped(current => current === id ? '' : current), 220); setNotice(next.length >= MAX_SEATS && !selected.includes(id) ? `You can select up to ${MAX_SEATS} seats.` : '') }
  return <div className="seat-stage">
    <p className="seat-helper">Select up to 10 seats. Seats are reserved once you submit your payment proof.</p>
    <div className="seat-scroll-hint">← Swipe to see all seats →</div>
    <div className="seat-map-wrap" ref={wrapRef}><div className="seat-map">
      <div className="screen" style={{ '--occupancy': occupancy } as React.CSSProperties}>
        <div className="screen-arc" aria-hidden="true">
          <svg className="screen-arc-glow" viewBox="0 0 1000 24" preserveAspectRatio="none" focusable="false"><path d="M4 21 Q500 -3 996 21" /></svg>
          <svg viewBox="0 0 1000 24" preserveAspectRatio="none" focusable="false"><path d="M4 21 Q500 -3 996 21" /></svg>
        </div>
        <p className="eyebrow-caps screen-label">Screen</p>
      </div>
      {Object.entries(seatLayout).map(([row, segments]) => <div className={`seat-row ${row === 'G' ? 'cross-gap' : ''}`} key={row}><span className="row-label">{row}</span><div className="seat-grid">{Array.from({ length: 26 }, (_, col) => { const segment = segments.find(([start, nums]) => col + 1 >= start && col + 1 < start + nums.length); const n = segment ? segment[1][col + 1 - segment[0]] : undefined; if (!n) return <span className="seat-empty" key={col}/>; const seat = byId.get(`${row}-${n}`); const status = seat?.status ?? 'available'; const isSelected = selected.includes(`${row}-${n}`); return <button key={col} className={`seat seat-${isSelected ? 'selected' : status}${popped === `${row}-${n}` ? ' seat-pop' : ''}`} disabled={status !== 'available'} aria-pressed={isSelected} aria-label={`Row ${row}, seat ${n}, ${isSelected ? 'selected' : status}`} onClick={() => toggle(`${row}-${n}`)}>{status === 'taken' ? '×' : n}</button> })}</div><span className="row-label">{row}</span></div>)}
    </div></div>
    <div className="legend">{[['available','Available'],['selected','Your selection'],['reserved','Reserved (pending payment)'],['taken','Taken']].map(([kind, label]) => <span key={kind}><i className={`seat seat-${kind}`}>{kind === 'taken' ? '×' : ''}</i>{label}</span>)}</div>
    <div className="sr-only" aria-live="polite">{selected.length} seats selected, {MAX_SEATS - selected.length} seats left to select. {notice}</div>
    {notice && <p className="info-notice">{notice}</p>}
  </div>
}
