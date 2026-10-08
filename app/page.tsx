'use client'

import { Fragment, useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { CinemaAtmosphere } from '@/components/cinema-atmosphere'
import { BookingPanel, EVENT_DATE_SHORT, EVENT_PLACE } from '@/components/booking-panel'
import { SeatMap } from '@/components/seat-map'
import { StripeWave } from '@/components/stripe-wave'
import { W4WLogo } from '@/components/w4w-logo'
import { IS_MOCK, getSeats, subscribe } from '@/lib/booking-store'
import { EVENT, PRICE_PER_SEAT, eventTotal, formatPrice, type Seat } from '@/lib/event-config'

const facts = [EVENT_DATE_SHORT, ...EVENT.time.split(' · '), EVENT_PLACE, `${formatPrice(PRICE_PER_SEAT)} per seat`]
const steps = ['Pick seats', 'Pay via QR & upload proof', 'Get e-tickets after we verify']

function daysToEvent() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
  const event = new Date('2026-12-19T00:00:00+08:00')
  return Math.max(0, Math.ceil((event.getTime() - now.getTime()) / 86400000))
}

export default function Page() {
  const [selected, setSelected] = useState<string[]>([])
  const [availableSeats, setAvailableSeats] = useState<Seat[]>([])
  const [live, setLive] = useState(false)
  const [animatedSeatsLeft, setAnimatedSeatsLeft] = useState(315)
  const [days, setDays] = useState(daysToEvent())
  const [submitting, setSubmitting] = useState(false)
  const [booked, setBooked] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    getSeats().then(seats => { setAvailableSeats(seats); setLive(true) })
    return subscribe(setAvailableSeats)
  }, [])

  const reservedCount = availableSeats.filter(seat => seat.status !== 'available').length
  const seatsLeft = 315 - reservedCount
  useEffect(() => {
    const start = animatedSeatsLeft
    const delta = seatsLeft - start
    if (!delta) return
    const started = performance.now()
    let frame = 0
    const tick = (time: number) => {
      const progress = Math.min(1, (time - started) / 400)
      setAnimatedSeatsLeft(Math.round(start + delta * progress))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [seatsLeft])
  useEffect(() => { const timer = window.setInterval(() => setDays(daysToEvent()), 86400000); return () => window.clearInterval(timer) }, [])
  const scrollToMap = () => document.getElementById('seats')?.scrollIntoView()

  return <main>
    <CinemaAtmosphere />
    {IS_MOCK && <div className="preview-notice">Preview mode: bookings are not saved</div>}
    <section id="top" className="title-block">
      <StripeWave bg="transparent" className="wave-texture" />
      <div className="container container-wide title-inner">
        <W4WLogo />
        <p className="eyebrow-caps">Now booking · {EVENT.film} charity screening</p>
        <h1>Claim a seat. <span>Bring clean water.</span></h1>
        <p className="facts-line">{facts.map((fact, i) => <Fragment key={fact}>{i > 0 && ' '}<span>{fact}{i < facts.length - 1 && ' ·'}</span></Fragment>)}</p>
        <div className="status-row">
          <span className="status-pill"><b>{animatedSeatsLeft}</b> seats available</span>
          {live ? <span className="live eyebrow-caps"><i aria-hidden="true" />Live</span> : <span className="live">Connecting…</span>}
          {days > 0 && <span className="countdown">{days} days to go</span>}
        </div>
        <p className="steps-line">{steps.map((step, i) => <span key={step}><b>0{i + 1}</b> {step}</span>)}</p>
        <button className="btn-primary title-cta" onClick={scrollToMap}>Pick your seats <ArrowRight /></button>
      </div>
    </section>
    <section id="seats" className="booking-zone" aria-label="Seat map and booking">
      <div className="container container-wide booking-grid">
        <div className="map-column">
          <SeatMap selected={selected} onChange={setSelected} submitting={submitting} occupancy={reservedCount / 315} />
          <div className="selection-bar">
            <div><strong>{selected.length} seat{selected.length === 1 ? '' : 's'}</strong><span>{selected.length ? selected.join(' · ') : 'No seats selected'} · {eventTotal(selected.length)}</span></div>
            <button className="btn-primary" disabled={!selected.length && !booked} aria-haspopup="dialog" onClick={() => setSheetOpen(true)}>{booked && !selected.length ? 'View ticket' : 'Continue'} <ArrowRight /></button>
          </div>
        </div>
        <BookingPanel selected={selected} onSelectedChange={setSelected} onSubmittingChange={setSubmitting} onBookedChange={setBooked} onReserveMore={() => { setSheetOpen(false); scrollToMap() }} sheetOpen={sheetOpen} onSheetOpenChange={setSheetOpen} />
      </div>
    </section>
    <footer><div className="container container-wide footer-inner"><p className="eyebrow-caps">Waves for Water Philippines</p><p className="mission">"To get clean water to every single person who needs it."</p><div className="footer-base"><span>Access to clean water is a fundamental human right.</span><span>[CONTACT TBD]</span></div></div></footer>
  </main>
}
