'use client'

import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { Droplet, Gift, Ticket, X } from 'lucide-react'
import type { Settings } from '@/lib/booking-store'
import { formatPrice } from '@/lib/event-config'
import { bundleOffer } from '@/lib/pricing'

// Event exclusives popup (DESIGN.md Section 0): a cinema-ticket card, a bottom sheet on phones.
// Native modal <dialog>: focus stays inside, Esc closes; × / "Pick your seats" / tapping outside also close.

// Snacks line: shown in this popup and in the "What's included" box at checkout
export const SHOW_FOOD_LINE = true
const SEEN_KEY = 'w4w-event-exclusives-seen'
const OPEN_AFTER_MS = 2000

// Once per visit: sessionStorage survives reloads and coming back from GCash, but not a new visit
const wasSeen = () => { try { return sessionStorage.getItem(SEEN_KEY) === '1' } catch { return false } }
const markSeen = () => { try { sessionStorage.setItem(SEEN_KEY, '1') } catch { /* storage blocked: it may show again */ } }

const STATS = [
  { value: '~₱3,500', label: '1 filter + bucket' },
  { value: '~25 people', label: 'share each filter' },
  { value: '5–10 years', label: 'of clean water' },
]

export function BottleIcon() {
  return <svg className="exclusives-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 2h4" />
    <path d="M10 2v3l-2 3v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8l-2-3V2" />
    <path d="M8 12h8" />
  </svg>
}

// blocked: the booking sheet is open, so the popup doesn't open on top of it
export function EventExclusives({ settings, blocked }: { settings: Settings | null; blocked: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const blockedRef = useRef(blocked)
  const pressedBackdrop = useRef(false)
  const bundle = bundleOffer(settings)
  const on = bundle !== null

  useEffect(() => { blockedRef.current = blocked }, [blocked])

  // Once per visit, about 2 seconds after the page is ready, and only while the bundle is on
  useEffect(() => {
    if (!on || wasSeen()) return
    const timer = window.setTimeout(() => {
      const el = dialog.current
      if (!el || el.open || blockedRef.current) return
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      el.showModal()
      markSeen()
    }, OPEN_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [on])

  if (!bundle) return null

  const close = () => dialog.current?.close()
  // Tapping outside: the dialog box itself is only hit on the backdrop (the ticket fills it)
  const onPointerDown = (event: PointerEvent<HTMLDialogElement>) => { pressedBackdrop.current = event.target === event.currentTarget }
  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => { if (pressedBackdrop.current && event.target === event.currentTarget) close() }
  const onClose = () => { if (opener.current?.isConnected) opener.current.focus() }
  // Tab wraps between the first and last button, so focus never leaves the popup
  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return
    const buttons = [...event.currentTarget.querySelectorAll<HTMLElement>('button')]
    const first = buttons[0], last = buttons[buttons.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  return <dialog ref={dialog} className="exclusives" aria-labelledby="exclusives-title" aria-describedby="exclusives-subtitle" onPointerDown={onPointerDown} onClick={onBackdropClick} onClose={onClose} onKeyDown={onKeyDown}>
    <div className="exclusives-top">
      <span className="exclusives-handle" aria-hidden="true" />
      <p className="eyebrow-caps exclusives-label"><Ticket aria-hidden="true" />Event exclusives</p>
      <h2 id="exclusives-title" className="exclusives-title">One night. One cinema. 315 heroes.</h2>
      <p id="exclusives-subtitle" className="exclusives-subtitle">Assemble for water.</p>
      <button type="button" className="exclusives-close" aria-label="Close" onClick={close}><X aria-hidden="true" /></button>
    </div>
    <div className="exclusives-bottom">
      <div className="exclusives-bundle">
        <p className="exclusives-bundle-label">Corporate Bundle</p>
        <p className="exclusives-bundle-price"><strong>{formatPrice(bundle.total)}</strong> for {bundle.size} tickets</p>
        <span className="exclusives-badge">Save {formatPrice(bundle.saving)}</span>
      </div>
      <ul className="exclusives-perks">
        <li><Gift className="exclusives-icon" aria-hidden="true" /><span><strong>1 ticket = 1 raffle entry.</strong> Win prizes from Columbia, The Coffee Bean &amp; Tea Leaf, Nono’s and RAF Forwarding.</span></li>
        {SHOW_FOOD_LINE && <li><BottleIcon /><span>Snacks and refreshments included</span></li>}
      </ul>
      <div className="exclusives-impact">
        <p className="exclusives-impact-lead"><Droplet className="exclusives-icon" aria-hidden="true" />₱500 of every ticket goes straight to clean water</p>
        <ul className="exclusives-stats">
          {STATS.map(({ value, label }) => <li key={value}><strong>{value}</strong>{label}</li>)}
        </ul>
      </div>
      <button type="button" className="btn-primary full" onClick={close}>Pick your seats</button>
    </div>
  </dialog>
}
