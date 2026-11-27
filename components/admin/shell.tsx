'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Download, ExternalLink, LogOut, Menu, X } from 'lucide-react'
import { usePauseRefresh } from './refresh-pause'

export type AdminRoute = 'home' | 'checkin' | 'checkin-history' | 'check' | 'waiting' | 'confirmed' | 'not-approved' | 'qr-emails'
// checkIn: "arrived/total" guests, e.g. "12/315" (missing until the counter loads)
export type NavCounts = { pending: number; approved: number; rejected: number; checkIn?: string } | null

type ShellProps = {
  route: AdminRoute
  counts: NavCounts
  email: string
  onExport: () => void
  onSignOut: () => void
  children: ReactNode
}

// Laptop: sidebar menu. Phone/tablet (<1024px): top bar with a "Menu" button that opens
// the same menu full-screen. The panel is a native modal <dialog>: focus stays inside,
// Esc closes it, and focus returns to the Menu button.
export function AdminShell({ route, counts, email, onExport, onSignOut, children }: ShellProps) {
  const menu = useRef<HTMLDialogElement>(null)
  const closeMenu = () => menu.current?.close()
  const [menuOpen, setMenuOpen] = useState(false)
  usePauseRefresh(menuOpen) // no auto-refresh while the phone menu is open

  // Any page change (link, Back button) closes the phone menu
  useEffect(() => { menu.current?.close() }, [route])

  const nav = (onNavigate?: () => void) => <AdminNav route={route} counts={counts} email={email} onNavigate={onNavigate} onExport={() => { onNavigate?.(); onExport() }} onSignOut={onSignOut} />

  return <div className="admin-layout">
    <aside className="admin-sidebar" aria-label="Admin menu"><Brand />{nav()}</aside>

    <header className="admin-topbar">
      <Brand />
      <button className="btn-ghost admin-menu-button" type="button" aria-haspopup="dialog" onClick={() => { menu.current?.showModal(); setMenuOpen(true) }}><Menu size={18} aria-hidden />Menu</button>
    </header>
    <dialog ref={menu} className="admin-menu" aria-label="Admin menu" onClose={() => setMenuOpen(false)}>
      <div className="admin-menu-head">
        <Brand />
        <button className="admin-icon-button" type="button" aria-label="Close menu" onClick={closeMenu}><X size={22} aria-hidden /></button>
      </div>
      {nav(closeMenu)}
    </dialog>

    <div className="admin-content">{children}</div>
  </div>
}

function Brand() {
  return <div className="admin-brand">
    <span className="eyebrow-caps">Movies4Water</span>
    <span className="admin-brand-sub">Admin</span>
  </div>
}

function AdminNav({ route, counts, email, onNavigate, onExport, onSignOut }: { route: AdminRoute; counts: NavCounts; email: string; onNavigate?: () => void; onExport: () => void; onSignOut: () => void }) {
  // "Waiting for review" covers the guided check and the full waiting list
  const current = (to: AdminRoute) => route === to || (to === 'check' && route === 'waiting')
  const link = (to: AdminRoute, label: string, count?: number | string, gold = false, countLabel?: string) =>
    <a className="admin-nav-link" href={`#${to}`} aria-current={current(to) ? 'page' : undefined} onClick={onNavigate}>
      <span>{label}</span>
      {count !== undefined && <span className={`admin-count${gold && Number(count) > 0 ? ' is-gold' : ''}`} aria-label={countLabel}>{count}</span>}
    </a>
  const canExport = !!counts?.approved
  const hintId = useId()

  return <nav className="admin-nav">
    {link('home', 'Home')}

    <p className="admin-nav-label">Event day</p>
    {link('checkin', 'Check-in', counts?.checkIn, false, counts?.checkIn && `${counts.checkIn.replace('/', ' of ')} guests arrived`)}
    {link('checkin-history', 'Check-in history')}

    <p className="admin-nav-label">Payments</p>
    {link('check', 'Waiting for review', counts?.pending, true)}
    {link('confirmed', 'Confirmed', counts?.approved)}
    {link('not-approved', 'Not approved', counts?.rejected)}

    <p className="admin-nav-label">Tools</p>
    <button className="admin-nav-link" type="button" onClick={onExport} disabled={!canExport} aria-describedby={canExport ? undefined : hintId}>
      <span className="admin-nav-icon"><Download size={18} aria-hidden />Download guest list</span>
    </button>
    {!canExport && <p className="admin-nav-hint" id={hintId}>{counts ? 'Available once a booking is confirmed.' : 'Loading…'}</p>}
    {link('qr-emails', 'Send check-in QR codes')}

    <div className="admin-nav-foot">
      <a className="admin-nav-link" href="/" target="_blank" rel="noopener noreferrer"><span className="admin-nav-icon"><ExternalLink size={18} aria-hidden />View the booking page</span></a>
      <p className="admin-signed-in">Signed in as <strong>{email}</strong></p>
      <button className="admin-nav-link" type="button" onClick={onSignOut}><span className="admin-nav-icon"><LogOut size={18} aria-hidden />Sign out</span></button>
    </div>
  </nav>
}
