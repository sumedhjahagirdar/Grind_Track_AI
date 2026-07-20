import { format } from 'date-fns'
import { RefreshCw, Loader2, Calendar, CalendarDays, CalendarRange, AlertTriangle, CheckCircle2, BookOpen, StickyNote } from 'lucide-react'
import type { RecommendationPayload } from '../lib/types'

interface Props {
  rec: RecommendationPayload | null
  generatedAt: string | undefined
  regenerating: boolean
  onRegenerate: () => void
}

export default function RecommendationCard({ rec, generatedAt, regenerating, onRegenerate }: Props) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-ink-900 flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-brand-600" />
          AI Recommendations
        </h2>
        <button onClick={onRegenerate} disabled={regenerating} className="btn-ghost text-xs">
          {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Regenerate
        </button>
      </div>

      {generatedAt && (
        <p className="text-[11px] text-ink-400 mb-3">
          Generated {format(new Date(generatedAt), 'MMM d, h:mm a')}
        </p>
      )}

      {!rec ? (
        <div className="text-center py-8 text-ink-400 text-sm">
          <span className="block text-2xl text-brand-600 mx-auto mb-2 opacity-40">✦</span>
          No recommendations yet. Log an entry or click Regenerate to let the AI build your plan.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tomorrow — green sticky */}
          <StickyNoteCard
            icon={<Calendar className="h-4 w-4" />}
            title="Tomorrow"
            rotate="-1.5"
            color="emerald"
          >
            <div className="flex gap-2 mb-2 text-xs">
              <span className="chip bg-emerald-100 text-emerald-800">Easy: {rec.tomorrow.leetcode_targets.easy}</span>
              <span className="chip bg-emerald-100 text-emerald-800">Medium: {rec.tomorrow.leetcode_targets.medium}</span>
              <span className="chip bg-emerald-100 text-emerald-800">Hard: {rec.tomorrow.leetcode_targets.hard}</span>
            </div>
            {rec.tomorrow.topics_to_practice?.length > 0 && <BulletList items={rec.tomorrow.topics_to_practice} label="Practice" />}
            {rec.tomorrow.learning_tasks?.length > 0 && <BulletList items={rec.tomorrow.learning_tasks} label="Learn" />}
          </StickyNoteCard>

          {/* This Week — amber sticky */}
          <StickyNoteCard
            icon={<CalendarDays className="h-4 w-4" />}
            title="This Week"
            rotate="1"
            color="amber"
          >
            {rec.this_week.topics_to_finish?.length > 0 && <BulletList items={rec.this_week.topics_to_finish} label="Finish" />}
            <div className="flex gap-2 text-xs mt-1">
              <span className="chip bg-amber-100 text-amber-800">Target: {rec.this_week.question_targets.easy}E / {rec.this_week.question_targets.medium}M / {rec.this_week.question_targets.hard}H</span>
            </div>
            {rec.this_week.milestone && (
              <div className="mt-2 text-sm text-ink-800 bg-amber-50/80 border border-amber-300/40 rounded-lg px-3 py-2">
                <strong className="text-amber-700">Milestone:</strong> {rec.this_week.milestone}
              </div>
            )}
          </StickyNoteCard>

          {/* This Month — blue sticky */}
          <StickyNoteCard
            icon={<CalendarRange className="h-4 w-4" />}
            title="This Month"
            rotate="-0.5"
            color="sky"
          >
            {rec.this_month.roadmap?.length > 0 && <BulletList items={rec.this_month.roadmap} />}
            <div className="mt-2">
              <span className={`chip ${readinessColor(rec.this_month.estimated_readiness)}`}>
                Readiness: {rec.this_month.estimated_readiness}
              </span>
            </div>
          </StickyNoteCard>

          {/* Weak areas & Strengths — pink & green stickies */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StickyNoteCard
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Weak Areas"
              rotate="1.5"
              color="rose"
              compact
            >
              {rec.weak_areas?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {rec.weak_areas.map((w, i) => <span key={i} className="chip bg-rose-100 text-rose-800">{w}</span>)}
                </div>
              ) : <span className="text-xs text-ink-500">None identified yet</span>}
            </StickyNoteCard>
            <StickyNoteCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              title="Strengths"
              rotate="-1"
              color="emerald"
              compact
            >
              {rec.strengths?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {rec.strengths.map((s, i) => <span key={i} className="chip bg-emerald-100 text-emerald-800">{s}</span>)}
                </div>
              ) : <span className="text-xs text-ink-500">Log more to identify</span>}
            </StickyNoteCard>
          </div>

          {/* Suggested resources — purple sticky */}
          {rec.suggested_resources?.length > 0 && (
            <StickyNoteCard
              icon={<BookOpen className="h-4 w-4" />}
              title="Suggested Resources"
              rotate="0.5"
              color="violet"
            >
              <div className="space-y-1.5">
                {rec.suggested_resources.map((r, i) => (
                  <div key={i} className="text-sm text-ink-800">
                    <span className="font-medium">{r.topic}</span>{' '}
                    <span className="text-ink-500">({r.type})</span>{' '}
                    — {r.suggestion}
                  </div>
                ))}
              </div>
            </StickyNoteCard>
          )}
        </div>
      )}
    </div>
  )
}

const STICKY_COLORS = {
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-300/50',
    header: 'text-emerald-800',
    iconBg: 'bg-emerald-200/70 text-emerald-800',
    tape: 'bg-emerald-300/40',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-300/50',
    header: 'text-amber-800',
    iconBg: 'bg-amber-200/70 text-amber-800',
    tape: 'bg-amber-300/40',
  },
  sky: {
    bg: 'bg-sky-50',
    border: 'border-sky-300/50',
    header: 'text-sky-800',
    iconBg: 'bg-sky-200/70 text-sky-800',
    tape: 'bg-sky-300/40',
  },
  rose: {
    bg: 'bg-rose-50',
    border: 'border-rose-300/50',
    header: 'text-rose-800',
    iconBg: 'bg-rose-200/70 text-rose-800',
    tape: 'bg-rose-300/40',
  },
  violet: {
    bg: 'bg-violet-50',
    border: 'border-violet-300/50',
    header: 'text-violet-800',
    iconBg: 'bg-violet-200/70 text-violet-800',
    tape: 'bg-violet-300/40',
  },
} as const

function StickyNoteCard({
  icon, title, rotate, color, compact, children,
}: {
  icon: React.ReactNode
  title: string
  rotate: string
  color: keyof typeof STICKY_COLORS
  compact?: boolean
  children: React.ReactNode
}) {
  const c = STICKY_COLORS[color]
  return (
    <div
      className={`relative ${c.bg} ${c.border} border rounded-lg ${compact ? 'p-3' : 'p-4'} shadow-card transition-transform duration-200 hover:rotate-0 hover:scale-[1.02] hover:shadow-card-hover`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {/* tape effect */}
      <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-4 ${c.tape} rounded-sm shadow-sm`} />
      <div className="flex items-center gap-2 mb-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.iconBg}`}>{icon}</div>
        <h3 className={`text-sm font-semibold ${c.header}`}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

function BulletList({ items, label }: { items: string[]; label?: string }) {
  return (
    <div>
      {label && <div className="text-[11px] text-ink-500 uppercase tracking-wide mb-1">{label}</div>}
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-ink-800 flex gap-2">
            <span className="text-ink-400 mt-0.5">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function readinessColor(s: string): string {
  const v = (s || '').toLowerCase()
  if (v.includes('ahead') || v.includes('on track')) return 'bg-emerald-100 text-emerald-800'
  if (v.includes('behind') || v.includes('at risk')) return 'bg-rose-100 text-rose-800'
  return 'bg-ink-100 text-ink-700'
}
