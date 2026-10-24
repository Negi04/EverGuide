import { Compass, HeartPulse, PiggyBank, Sparkles, UsersRound, type LucideIcon } from 'lucide-react'

type MapNode = { label: string; icon: LucideIcon; x: number; y: number; accent?: boolean }

// Positions are in the 520×460 coordinate space of the SVG below.
const center = { x: 260, y: 236 }
const nodes: MapNode[] = [
  { label: 'Career', icon: Compass, x: 112, y: 104 },
  { label: 'AI Guide', icon: Sparkles, x: 404, y: 92, accent: true },
  { label: 'Mentors', icon: UsersRound, x: 452, y: 288 },
  { label: 'Wellness', icon: HeartPulse, x: 292, y: 404 },
  { label: 'Finance', icon: PiggyBank, x: 84, y: 330 },
]

const pct = (value: number, total: number) => `${(value / total) * 100}%`

/**
 * Hero composition: one person at the centre, connected to every domain of guidance.
 * The gold route traces a path through AI Guide toward Mentors — guidance that leads to people.
 */
export function GuidanceMap() {
  return (
    <div className="relative mx-auto aspect-[520/460] w-full max-w-[34rem]" aria-hidden>
      <svg viewBox="0 0 520 460" className="absolute inset-0 size-full" fill="none">
        <defs>
          <radialGradient id="eg-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={center.x} cy={center.y} r="170" fill="url(#eg-glow)" />
        <circle cx={center.x} cy={center.y} r="112" stroke="white" strokeOpacity="0.07" />
        <circle cx={center.x} cy={center.y} r="196" stroke="white" strokeOpacity="0.05" strokeDasharray="2 6" />

        {nodes.map((node) => (
          <line
            key={node.label}
            x1={center.x}
            y1={center.y}
            x2={node.x}
            y2={node.y}
            stroke="#38BDF8"
            strokeOpacity="0.28"
            strokeWidth="1.25"
          />
        ))}

        <path
          d={`M${center.x} ${center.y} C 320 180, 360 150, 404 92 S 470 210, 452 288`}
          stroke="#F4B860"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="6 8"
          className="motion-safe:animate-[eg-dash_14s_linear_infinite]"
        />

        <circle cx={center.x} cy={center.y} r="50" stroke="#38BDF8" strokeOpacity="0.35" />
        <circle cx={center.x} cy={center.y} r="36" fill="#174EA6" />
        <text
          x={center.x}
          y={center.y + 5}
          textAnchor="middle"
          fill="white"
          fontSize="15"
          fontWeight="600"
          fontFamily="Figtree Variable, sans-serif"
        >
          You
        </text>
      </svg>

      {nodes.map(({ label, icon: Icon, x, y, accent }) => (
        <span
          key={label}
          style={{ left: pct(x, 520), top: pct(y, 460) }}
          className={
            'absolute inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap shadow-lg sm:text-sm ' +
            (accent
              ? 'border-gold-400/60 bg-navy-800 text-white'
              : 'border-white/15 bg-navy-800/90 text-ink-foreground')
          }
        >
          <Icon className={accent ? 'size-4 text-gold-400' : 'size-4 text-sky-400'} />
          {label}
        </span>
      ))}
    </div>
  )
}
