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
              <span className={`chip ${STICKY_COLORS.emerald.chip}`}>Easy: {rec.tomorrow.leetcode_targets.easy}</span>
              <span className={`chip ${STICKY_COLORS.emerald.chip}`}>Medium: {rec.tomorrow.leetcode_targets.medium}</span>
              <span className={`chip ${STICKY_COLORS.emerald.chip}`}>Hard: {rec.tomorrow.leetcode_targets.hard}</span>
            </div>
            {rec.tomorrow.topics_to_practice?.length > 0 && <BulletList items={rec.tomorrow.topics_to_practice} label="Practice" color="emerald" />}
            {rec.tomorrow.learning_tasks?.length > 0 && <BulletList items={rec.tomorrow.learning_tasks} label="Learn" color="emerald" />}
          </StickyNoteCard>

          {/* This Week — amber sticky */}
          <StickyNoteCard
            icon={<CalendarDays className="h-4 w-4" />}
            title="This Week"
            rotate="1"
            color="amber"
          >
            {rec.this_week.topics_to_finish?.length > 0 && <BulletList items={rec.this_week.topics_to_finish} label="Finish" color="amber" />}
            <div className="flex gap-2 text-xs mt-1">
              <span className={`chip ${STICKY_COLORS.amber.chip}`}>Target: {rec.this_week.question_targets.easy}E / {rec.this_week.question_targets.medium}M / {rec.this_week.question_targets.hard}H</span>
            </div>
            {rec.this_week.milestone && (
              <div className="mt-2 text-sm bg-amber-100/70 dark:bg-amber-900/30 border border-amber-300/40 dark:border-amber-700/40 rounded-lg px-3 py-2 text-amber-900 dark:text-amber-100">
                <strong className="text-amber-700 dark:text-amber-300">Milestone:</strong> {rec.this_week.milestone}
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
            {rec.this_month.roadmap?.length > 0 && <BulletList items={rec.this_month.roadmap} color="sky" />}
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
                  {rec.weak_areas.map((w, i) => <span key={i} className={`chip ${STICKY_COLORS.rose.chip}`}>{w}</span>)}
                </div>
              ) : <span className={`text-xs ${STICKY_COLORS.rose.secondary}`}>None identified yet</span>}
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
                  {rec.strengths.map((s, i) => <span key={i} className={`chip ${STICKY_COLORS.emerald.chip}`}>{s}</span>)}
                </div>
              ) : <span className={`text-xs ${STICKY_COLORS.emerald.secondary}`}>Log more to identify</span>}
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
                  <div key={i} className={`text-sm ${STICKY_COLORS.violet.body}`}>
                    <span className="font-medium">{r.topic}</span>{' '}
                    <span className={STICKY_COLORS.violet.secondary}>({r.type})</span>{' '}
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
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-300/50 dark:border-emerald-700/50',
    header: 'text-emerald-800 dark:text-emerald-300',
    iconBg: 'bg-emerald-200/70 text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-200',
    tape: 'bg-emerald-300/40 dark:bg-emerald-700/40',
    body: 'text-emerald-900 dark:text-emerald-100',
    bullet: 'text-emerald-500 dark:text-emerald-400',
    label: 'text-emerald-700/80 dark:text-emerald-400',
    secondary: 'text-emerald-700/70 dark:text-emerald-400',
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-200',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-300/50 dark:border-amber-700/50',
    header: 'text-amber-800 dark:text-amber-300',
    iconBg: 'bg-amber-200/70 text-amber-800 dark:bg-amber-800/50 dark:text-amber-200',
    tape: 'bg-amber-300/40 dark:bg-amber-700/40',
    body: 'text-amber-900 dark:text-amber-100',
    bullet: 'text-amber-500 dark:text-amber-400',
    label: 'text-amber-700/80 dark:text-amber-400',
    secondary: 'text-amber-700/70 dark:text-amber-400',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-800/50 dark:text-amber-200',
  },
  sky: {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    border: 'border-sky-300/50 dark:border-sky-700/50',
    header: 'text-sky-800 dark:text-sky-300',
    iconBg: 'bg-sky-200/70 text-sky-800 dark:bg-sky-800/50 dark:text-sky-200',
    tape: 'bg-sky-300/40 dark:bg-sky-700/40',
    body: 'text-sky-900 dark:text-sky-100',
    bullet: 'text-sky-500 dark:text-sky-400',
    label: 'text-sky-700/80 dark:text-sky-400',
    secondary: 'text-sky-700/70 dark:text-sky-400',
    chip: 'bg-sky-100 text-sky-800 dark:bg-sky-800/50 dark:text-sky-200',
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-rose-300/50 dark:border-rose-700/50',
    header: 'text-rose-800 dark:text-rose-300',
    iconBg: 'bg-rose-200/70 text-rose-800 dark:bg-rose-800/50 dark:text-rose-200',
    tape: 'bg-rose-300/40 dark:bg-rose-700/40',
    body: 'text-rose-900 dark:text-rose-100',
    bullet: 'text-rose-500 dark:text-rose-400',
    label: 'text-rose-700/80 dark:text-rose-400',
    secondary: 'text-rose-700/70 dark:text-rose-400',
    chip: 'bg-rose-100 text-rose-800 dark:bg-rose-800/50 dark:text-rose-200',
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    border: 'border-violet-300/50 dark:border-violet-700/50',
    header: 'text-violet-800 dark:text-violet-300',
    iconBg: 'bg-violet-200/70 text-violet-800 dark:bg-violet-800/50 dark:text-violet-200',
    tape: 'bg-violet-300/40 dark:bg-violet-700/40',
    body: 'text-violet-900 dark:text-violet-100',
    bullet: 'text-violet-500 dark:text-violet-400',
    label: 'text-violet-700/80 dark:text-violet-400',
    secondary: 'text-violet-700/70 dark:text-violet-400',
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-800/50 dark:text-violet-200',
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
      className={`relative ${c.bg} ${c.border} border rounded-lg ${compact ? 'p-3' : 'p-4'} shadow-card transition-transform duration-200 hover:rotate-0 hover:scale-[1.02] hover:shadow-card-hover ${c.body}`}
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

function BulletList({ items, label, color }: { items: string[]; label?: string; color: keyof typeof STICKY_COLORS }) {
  const c = STICKY_COLORS[color]
  return (
    <div>
      {label && <div className={`text-[11px] uppercase tracking-wide mb-1 ${c.label}`}>{label}</div>}
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className={`text-sm flex gap-2 ${c.body}`}>
            <span className={`mt-0.5 ${c.bullet}`}>•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function readinessColor(s: string): string {
  const v = (s || '').toLowerCase()
  if (v.includes('ahead') || v.includes('on track')) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-200'
  if (v.includes('behind') || v.includes('at risk')) return 'bg-rose-100 text-rose-800 dark:bg-rose-800/50 dark:text-rose-200'
  return 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200'
}
