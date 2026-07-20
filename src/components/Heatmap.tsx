import { useMemo } from 'react'
import { format, subDays, eachDayOfInterval, startOfWeek } from 'date-fns'
import clsx from 'clsx'

interface HeatmapProps {
  /** Manual log entries — used as fallback when no live calendar data is available. */
  logs?: { log_date: string; easy_solved: number; medium_solved: number; hard_solved: number }[]
  /** Live LeetCode submission calendar — primary source of truth when present. */
  liveCalendar?: { date: string; submission_count: number }[]
  weeks?: number
  title?: string
  /** Label shown in the corner: "last synced X ago" or similar. */
  syncLabel?: string
}

export default function Heatmap({ logs = [], liveCalendar, weeks = 20, title, syncLabel }: HeatmapProps) {
  const cells = useMemo(() => {
    const today = new Date()
    const gridStart = startOfWeek(subDays(today, (weeks - 1) * 7), { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: gridStart, end: today })

    // Build manual counts (fallback)
    const manualByDate = new Map<string, number>()
    for (const l of logs) {
      const existing = manualByDate.get(l.log_date) ?? 0
      manualByDate.set(l.log_date, existing + l.easy_solved + l.medium_solved + l.hard_solved)
    }

    // Build live counts (primary)
    const liveByDate = new Map<string, number>()
    if (liveCalendar) {
      for (const e of liveCalendar) {
        liveByDate.set(e.date, e.submission_count)
      }
    }

    return days.map((d) => {
      const s = format(d, 'yyyy-MM-dd')
      // Prefer live calendar; fall back to manual logs
      const count = liveByDate.has(s) ? (liveByDate.get(s) ?? 0) : (manualByDate.get(s) ?? 0)
      const source = liveByDate.has(s) ? 'live' : 'manual'
      return { date: s, count, day: d, source }
    })
  }, [logs, liveCalendar, weeks])

  const columns: typeof cells[] = useMemo(() => {
    const cols: typeof cells[] = []
    for (let i = 0; i < cells.length; i += 7) {
      cols.push(cells.slice(i, i + 7))
    }
    return cols
  }, [cells])

  const level = (count: number) => {
    if (count === 0) return 0
    if (count <= 2) return 1
    if (count <= 5) return 2
    if (count <= 8) return 3
    return 4
  }

  const levelColors = [
    'bg-ink-100',
    'bg-brand-100',
    'bg-brand-300',
    'bg-brand-400',
    'bg-brand-600',
  ]

  const monthLabels = useMemo(() => {
    const labels: { col: number; label: string }[] = []
    let lastMonth = -1
    columns.forEach((col, i) => {
      const firstDay = col[0]?.day
      if (firstDay) {
        const m = firstDay.getMonth()
        if (m !== lastMonth) {
          labels.push({ col: i, label: format(firstDay, 'MMM') })
          lastMonth = m
        }
      }
    })
    return labels
  }, [columns])

  const dayLabels = ['Mon', 'Wed', 'Fri']
  const hasLive = !!liveCalendar && liveCalendar.length > 0

  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
          {syncLabel && (
            <span className={clsx('text-[10px] px-2 py-0.5 rounded-full', hasLive ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-500')}>
              {syncLabel}
            </span>
          )}
        </div>
      )}
      <div className="flex gap-1">
        <div className="flex flex-col gap-[3px] mr-1 pt-5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-[13px] text-[9px] text-ink-400 flex items-center">
              {i % 2 === 0 ? dayLabels[i / 2] : ''}
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <div className="relative">
            <div className="flex gap-[3px] mb-1 h-4">
              {columns.map((_, i) => {
                const label = monthLabels.find((m) => m.col === i)
                return (
                  <div key={i} className="w-[13px] text-[9px] text-ink-400">
                    {label?.label ?? ''}
                  </div>
                )
              })}
            </div>
            <div className="flex gap-[3px]">
              {columns.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-[3px]">
                  {col.map((cell, ri) => (
                    <div
                      key={ri}
                      className={clsx('w-[13px] h-[13px] rounded-[2px] transition-all', levelColors[level(cell.count)],
                        cell.source === 'live' && cell.count > 0 && 'ring-1 ring-brand-300/50')}
                      title={`${cell.date}: ${cell.count} solved (${cell.source})`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2 ml-8">
        <span className="text-[10px] text-ink-400">Less</span>
        {levelColors.map((c, i) => (
          <div key={i} className={clsx('w-[11px] h-[11px] rounded-[2px]', c)} />
        ))}
        <span className="text-[10px] text-ink-400">More</span>
        {hasLive && <span className="text-[10px] text-brand-600 ml-2">● live from LeetCode</span>}
      </div>
    </div>
  )
}
