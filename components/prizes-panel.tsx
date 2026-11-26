'use client'

import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type SyntheticEvent } from 'react'
import { ChevronRight, Image as ImageIcon, X } from 'lucide-react'
import { RAFFLE_PRIZES } from '@/components/raffle-prizes'

// "See the prizes" button + prizes panel (DESIGN.md Section 0). Native modal <dialog>s:
// the panel is a bottom sheet on phones and a centred card from 700px; tapping a row with a
// photo opens it full screen in a nested <dialog>. Photos load only when a row is tapped.

type Photo = { src: string; alt: string; caption: string }

// Tab wraps between the first and last button, so focus never leaves the dialog
function trapTab(event: KeyboardEvent<HTMLDialogElement>, buttons: HTMLElement[]) {
  if (event.key !== 'Tab' || !buttons.length) return
  const first = buttons[0], last = buttons[buttons.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}

// Tapping outside closes: the dialog box itself is only hit outside its content
function useBackdropClose(close: () => void) {
  const pressed = useRef(false)
  return {
    onPointerDown: (event: PointerEvent<HTMLDialogElement>) => { pressed.current = event.target === event.currentTarget },
    onClick: (event: MouseEvent<HTMLDialogElement>) => { if (pressed.current && event.target === event.currentTarget) close() },
  }
}

// onOpenChange: lets the page keep the event exclusives popup from opening on top
export function PrizesPanel({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const panel = useRef<HTMLDialogElement>(null)
  const viewer = useRef<HTMLDialogElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const row = useRef<HTMLButtonElement | null>(null)
  const [photo, setPhoto] = useState<Photo | null>(null)

  const open = () => {
    const el = panel.current
    if (!el || el.open || document.querySelector('dialog[open]')) return
    el.showModal()
    onOpenChange(true)
  }
  const close = () => panel.current?.close()
  const closePhoto = () => viewer.current?.close()
  const showPhoto = (next: Photo, button: HTMLButtonElement) => {
    row.current = button
    setPhoto(next)
    viewer.current?.showModal()
  }

  // 'close' is checked against the dialog itself, so the nested viewer closing doesn't count
  const onPanelClose = (event: SyntheticEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return
    onOpenChange(false)
    opener.current?.focus()
  }
  const onViewerClose = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.stopPropagation()
    setPhoto(null)
    if (row.current?.isConnected) row.current.focus()
  }
  const panelBackdrop = useBackdropClose(close)
  const viewerBackdrop = useBackdropClose(closePhoto)

  return <>
    <button ref={opener} type="button" className="prizes-button" aria-haspopup="dialog" onClick={open}>See the prizes <ChevronRight aria-hidden="true" /></button>
    <dialog
      ref={panel}
      className="prizes"
      aria-labelledby="prizes-title"
      aria-describedby="prizes-lead"
      {...panelBackdrop}
      onClose={onPanelClose}
      onKeyDown={event => { if (!viewer.current?.contains(event.target as Node)) trapTab(event, [...(card.current?.querySelectorAll<HTMLElement>('button') ?? [])]) }}
    >
      <div ref={card} className="prizes-card">
        <div className="prizes-top">
          <span className="exclusives-handle" aria-hidden="true" />
          <h2 id="prizes-title" className="prizes-title">Raffle prizes</h2>
          <p id="prizes-lead" className="prizes-lead">1 ticket = 1 raffle entry. Book 10, get 10 entries.</p>
          <button type="button" className="exclusives-close" aria-label="Close" onClick={close}><X aria-hidden="true" /></button>
        </div>
        {RAFFLE_PRIZES.map(({ sponsor, prizes }) => <section key={sponsor} className="prizes-group" aria-label={sponsor}>
          <h3 className="prizes-sponsor">{sponsor}</h3>
          <ul className="prizes-list">
            {prizes.map(({ name, quantity, photo: src }) => {
              const content = <>
                <span className="prizes-row-icon">{src && <ImageIcon aria-hidden="true" />}</span>
                <span className="prizes-name">{name}</span>
                <span className="prizes-qty"><span aria-hidden="true">×{quantity}</span><span className="sr-only">, quantity {quantity}</span></span>
                <span className="prizes-row-icon">{src && <ChevronRight aria-hidden="true" />}</span>
              </>
              return <li key={name}>{src
                ? <button type="button" className="prizes-row" aria-haspopup="dialog" onClick={event => showPhoto({ src, alt: `${sponsor} ${name.replace(/ \(.*\)$/, '')}`, caption: name }, event.currentTarget)}>{content}<span className="sr-only">, view photo</span></button>
                : <div className="prizes-row">{content}</div>}</li>
            })}
          </ul>
        </section>)}
        <button type="button" className="btn-primary full" onClick={close}>Pick your seats</button>
      </div>
      <dialog
        ref={viewer}
        className="prizes-viewer"
        aria-label={photo ? `Photo: ${photo.caption}` : 'Photo'}
        {...viewerBackdrop}
        onClose={onViewerClose}
        onKeyDown={event => { if (event.key === 'Tab') event.preventDefault() }}
      >
        <button type="button" className="exclusives-close" aria-label="Close photo" onClick={closePhoto}><X aria-hidden="true" /></button>
        {photo && <figure className="prizes-photo">
          <img src={photo.src} alt={photo.alt} decoding="async" />
          <figcaption>{photo.caption}</figcaption>
        </figure>}
      </dialog>
    </dialog>
  </>
}
