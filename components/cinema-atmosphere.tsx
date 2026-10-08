'use client'
import { useEffect, useRef } from 'react'

// Light shafts (deviation 16): original code-only beams, falling from the top of the page
const shafts = [
  { x: '8%', angle: '18deg', width: '16vw', delay: '0s' },
  { x: '30%', angle: '8deg', width: '10vw', delay: '-5s' },
  { x: '54%', angle: '-4deg', width: '18vw', delay: '-9s', gold: true },
  { x: '74%', angle: '-12deg', width: '12vw', delay: '-3s' },
  { x: '92%', angle: '-20deg', width: '14vw', delay: '-12s' },
]

type Mote = { x: number; y: number; r: number; vy: number; sway: number; phase: number; age: number; life: number; alpha: number; blue: boolean }

const FRAME_MS = 1000 / 30 // plus up to one vsync of rAF wait, so ~25fps in practice

function mote(w: number, h: number, anywhere: boolean): Mote {
  return {
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : h + 4,
    r: 1 + Math.random() * 2,
    vy: 8 + Math.random() * 16,
    sway: 6 + Math.random() * 14,
    phase: Math.random() * Math.PI * 2,
    age: anywhere ? Math.random() * 12 : 0,
    life: 10 + Math.random() * 10,
    alpha: .15 + Math.random() * .35,
    blue: Math.random() < .2,
  }
}

// Particles (deviation 17): rising "water-light" motes on one canvas, no libraries
function useParticles(ref: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const mobile = window.matchMedia('(max-width: 700px)')
    const tokens = getComputedStyle(document.documentElement)
    const green = tokens.getPropertyValue('--ev-green').trim()
    const blue = tokens.getPropertyValue('--blue-light').trim()
    let motes: Mote[] = []
    let w = 0
    let h = 0
    let frame = 0
    let timer = 0
    let last = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = mobile.matches ? 20 : 45
      motes = motes.slice(0, count)
      while (motes.length < count) motes.push(mote(w, h, true))
    }

    // A timer paces the loop so the browser only renders a frame when we draw (~25fps), not at every vsync
    const draw = (time: number) => {
      timer = window.setTimeout(() => { frame = requestAnimationFrame(draw) }, FRAME_MS)
      const dt = Math.min(Math.max(time - last, 0) / 1000, .1)
      last = time
      ctx.clearRect(0, 0, w, h)
      motes.forEach((m, i) => {
        m.age += dt
        m.y -= m.vy * dt
        if (m.age > m.life || m.y < -4) { motes[i] = mote(w, h, false); return }
        const fade = Math.sin(Math.PI * m.age / m.life)
        const x = m.x + Math.sin(m.phase + m.age * .6) * m.sway
        ctx.fillStyle = m.blue ? blue : green
        ctx.globalAlpha = m.alpha * fade * .25
        ctx.beginPath()
        ctx.arc(x, m.y, m.r * 2.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = m.alpha * fade
        ctx.beginPath()
        ctx.arc(x, m.y, m.r, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    const stop = () => { cancelAnimationFrame(frame); window.clearTimeout(timer) }

    const start = () => {
      stop()
      if (reduce.matches || document.hidden) { if (reduce.matches) ctx.clearRect(0, 0, w, h); return }
      last = performance.now()
      frame = requestAnimationFrame(draw)
    }

    resize()
    start()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', start)
    reduce.addEventListener('change', start)
    return () => {
      stop()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', start)
      reduce.removeEventListener('change', start)
    }
  }, [ref])
}

export function CinemaAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useParticles(canvasRef)
  return <div className="atmosphere" aria-hidden="true">
    <div className="light-shafts">
      {shafts.map(s => <span key={s.x} className={s.gold ? 'shaft shaft-gold' : 'shaft'} style={{ '--x': s.x, '--angle': s.angle, '--w': s.width, '--delay': s.delay } as React.CSSProperties} />)}
    </div>
    <canvas ref={canvasRef} className="particles" />
  </div>
}
