// components/stripe-wave.tsx
// W4W signature divider: 6 parallel white sine lines (3px) on a solid band.
// Static, aria-hidden, stretches to any width. See DESIGN.md Section 8.

type StripeWaveProps = {
  /** Band background behind the lines. Default: var(--char) */
  bg?: string
  /** Fills the area above the first line with the previous section's color,
   *  following the wave curve. Omit to make the whole band `bg`. */
  top?: string
  className?: string
}

const W = 1200 // viewBox width
const H = 120 // viewBox height
const LINES = 6
const FIRST = 31 // y of the first line's centerline
const GAP = 10.5 // even spacing between lines
const AMP = 8 // wave amplitude
const WAVES = 2 // full waves across the width
const PHASE = -1.75
const STEPS = 96 // smoothness

const waveY = (x: number, base: number) =>
  base + AMP * -Math.sin((x / W) * WAVES * 2 * Math.PI + Math.PI / 2 + PHASE)

const points = (base: number) =>
  Array.from({ length: STEPS + 1 }, (_, i) => {
    const x = (i / STEPS) * W
    return `${x.toFixed(1)},${waveY(x, base).toFixed(2)}`
  })

const linePath = (base: number) => `M${points(base).join(" L")}`

const topFillPath = () =>
  `M0,0 L${W},0 L${points(FIRST).reverse().join(" L")} Z`

export function StripeWave({
  bg = "var(--char)",
  top,
  className = "",
}: StripeWaveProps) {
  return (
    <svg
      className={`stripe-wave ${className}`.trim()}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      style={{ background: bg }}
    >
      {top && <path d={topFillPath()} fill={top} />}
      {Array.from({ length: LINES }, (_, i) => (
        <path
          key={i}
          d={linePath(FIRST + i * GAP)}
          fill="none"
          stroke="#fff"
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}
