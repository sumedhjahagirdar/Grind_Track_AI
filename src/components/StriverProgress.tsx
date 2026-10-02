import type { StriverSection } from '../lib/types'

export default function StriverProgress({ sections }: { sections: StriverSection[] }) {
  const completed = sections.reduce((s, sec) => s + sec.solved_count, 0)
  const total = sections.reduce((s, sec) => s + sec.total_problems, 0)
  const percentage = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-ink-800">Striver A2Z DSA</span>
        <span className="text-sm font-semibold text-brand-600 dark:text-brand-400 tabular-nums">
          {percentage}%
        </span>
      </div>
      <div className="text-xs text-ink-500 mb-2.5 tabular-nums">
        {completed} / {total} completed
      </div>
      <div className="h-2 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-glow-500 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
