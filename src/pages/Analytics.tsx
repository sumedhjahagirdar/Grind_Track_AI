import { useEffect, useState, useMemo } from 'react'
import { format, subDays, eachDayOfInterval, formatDistanceToNow } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend,
} from 'recharts'
import {
  fetchDailyLogs, fetchLeetcodeSnapshots, fetchCodeforcesSnapshots,
  fetchLeetcodeCalendar, fetchLeetcodeSyncLog,
  syncLeetcode, syncCodeforces, syncLeetcodeCalendar,
} from '../lib/api'
import type { DailyLog, LeetcodeSnapshot, CodeforcesSnapshot, LeetcodeCalendarEntry, LeetcodeSyncLogEntry } from '../lib/types'
import Heatmap from '../components/Heatmap'
import { RefreshCw, Loader2 } from 'lucide-react'

export default function Analytics() {
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [snapshots, setSnapshots] = useState<LeetcodeSnapshot[]>([])
  const [cfSnapshots, setCfSnapshots] = useState<CodeforcesSnapshot[]>([])
  const [liveCalendar, setLiveCalendar] = useState<LeetcodeCalendarEntry[]>([])
  const [syncLog, setSyncLog] = useState<LeetcodeSyncLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [syncingLc, setSyncingLc] = useState(false)
  const [syncingCf, setSyncingCf] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [l, s, c, cal, sl] = await Promise.all([
        fetchDailyLogs(365),
        fetchLeetcodeSnapshots(365),
        fetchCodeforcesSnapshots(365),
        fetchLeetcodeCalendar(400),
        fetchLeetcodeSyncLog(5),
      ])
      setLogs(l)
      setSnapshots(s)
      setCfSnapshots(c)
      setLiveCalendar(cal)
      setSyncLog(sl)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSyncLc = async () => {
    setSyncingLc(true); setSyncError(null)
    const r = await syncLeetcodeCalendar()
    if (r.error) setSyncError(r.error)
    else await load()
    setSyncingLc(false)
  }

  const handleSyncCf = async () => {
    setSyncingCf(true); setSyncError(null)
    const r = await syncCodeforces()
    if ('error' in r) setSyncError(r.error)
    else await load()
    setSyncingCf(false)
  }

  const lastSync = syncLog[0]
  const syncLabel = lastSync
    ? lastSync.status === 'success'
      ? `Last synced ${formatDistanceToNow(new Date(lastSync.created_at))}`
      : `Last sync failed ${formatDistanceToNow(new Date(lastSync.created_at))}`
    : 'Not synced yet'

  // Primary chart data source: live LeetCode submission calendar (per-day counts).
  // Fallback: manual daily_logs when no live calendar data is available.
  const chartData = useMemo(() => {
    const end = new Date()
    const start = subDays(end, 29)
    const days = eachDayOfInterval({ start, end })

    // Live calendar: per-day submission counts (primary)
    const liveByDate = new Map<string, number>()
    for (const e of liveCalendar) {
      liveByDate.set(e.date, e.submission_count)
    }
    const hasLive = liveCalendar.length > 0

    // Manual logs fallback
    const manualByDate = new Map<string, { easy: number; medium: number; hard: number }>()
    for (const l of logs) {
      const e = manualByDate.get(l.log_date) ?? { easy: 0, medium: 0, hard: 0 }
      e.easy += l.easy_solved
      e.medium += l.medium_solved
      e.hard += l.hard_solved
      manualByDate.set(l.log_date, e)
    }

    return days.map((d) => {
      const s = format(d, 'yyyy-MM-dd')
      if (hasLive && liveByDate.has(s)) {
        // Live data only gives a total count — show as "solved" bar, no difficulty split
        return {
          date: format(d, 'MMM d'),
          live: liveByDate.get(s) ?? 0,
          easy: 0, medium: 0, hard: 0,
          source: 'live' as const,
        }
      }
      const m = manualByDate.get(s) ?? { easy: 0, medium: 0, hard: 0 }
      return {
        date: format(d, 'MMM d'),
        live: 0,
        easy: m.easy,
        medium: m.medium,
        hard: m.hard,
        source: 'manual' as const,
      }
    })
  }, [logs, liveCalendar])

  const lcData = useMemo(() => snapshots.map((s) => ({
    date: format(new Date(s.snapshot_date), 'MMM d'),
    total: s.total_solved,
    rating: s.contest_rating ?? null,
  })), [snapshots])

  const cfData = useMemo(() => cfSnapshots.map((s) => ({
    date: format(new Date(s.snapshot_date), 'MMM d'),
    rating: s.rating,
    solved: s.solved_count,
  })), [cfSnapshots])

  const topicMap = useMemo(() => {
    const m = new Map<string, { count: number; last: string | null }>()
    for (const l of logs) {
      for (const t of l.topics) {
        const e = m.get(t) ?? { count: 0, last: null }
        e.count += l.easy_solved + l.medium_solved + l.hard_solved
        if (!e.last || l.log_date > e.last) e.last = l.log_date
        m.set(t, e)
      }
    }
    return m
  }, [logs])

  const weekOverWeek = useMemo(() => {
    const now = new Date()
    const thisWeekStart = subDays(now, 6)
    const lastWeekStart = subDays(now, 13)
    const lastWeekEnd = subDays(now, 7)
    const sum = (arr: DailyLog[]) => arr.reduce((s, l) => s + l.easy_solved + l.medium_solved + l.hard_solved, 0)
    const thisWeek = sum(logs.filter((l) => new Date(l.log_date) >= thisWeekStart))
    const lastWeek = sum(logs.filter((l) => { const d = new Date(l.log_date); return d >= lastWeekStart && d <= lastWeekEnd }))
    if (lastWeek === 0) return thisWeek > 0 ? 100 : 0
    return Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
  }, [logs])

  const monthOverMonth = useMemo(() => {
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    const sum = (arr: DailyLog[]) => arr.reduce((s, l) => s + l.easy_solved + l.medium_solved + l.hard_solved, 0)
    const thisMonth = sum(logs.filter((l) => new Date(l.log_date) >= thisMonthStart))
    const lastMonth = sum(logs.filter((l) => { const d = new Date(l.log_date); return d >= lastMonthStart && d <= lastMonthEnd }))
    if (lastMonth === 0) return thisMonth > 0 ? 100 : 0
    return Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
  }, [logs])

  const latestLc = snapshots[snapshots.length - 1]
  const latestCf = cfSnapshots[cfSnapshots.length - 1]

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-10 py-8 md:py-12 space-y-8 md:space-y-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Analytics</h1>
          <p className="text-sm text-ink-500">Your progress trends across LeetCode and Codeforces</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSyncLc} disabled={syncingLc} className="btn-outline">
            {syncingLc ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync LeetCode
          </button>
          <button onClick={handleSyncCf} disabled={syncingCf} className="btn-outline">
            {syncingCf ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync Codeforces
          </button>
        </div>
      </div>

      {syncError && <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">{syncError}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Week over week" value={`${weekOverWeek >= 0 ? '+' : ''}${weekOverWeek}%`} positive={weekOverWeek >= 0} />
        <MetricCard label="Month over month" value={`${monthOverMonth >= 0 ? '+' : ''}${monthOverMonth}%` } positive={monthOverMonth >= 0} />
        <MetricCard label="LeetCode total" value={latestLc ? String(latestLc.total_solved) : '—'} sub={latestLc ? `${latestLc.easy_solved}E / ${latestLc.medium_solved}M / ${latestLc.hard_solved}H` : 'Not synced'} />
        <MetricCard label="Codeforces rating" value={latestCf ? String(latestCf.rating) : '—'} sub={latestCf ? `${latestCf.solved_count} solved · ${latestCf.contest_count} contests` : 'Not synced'} />
      </div>

      {/* Heatmaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <Heatmap logs={logs} liveCalendar={liveCalendar} weeks={20} title="LeetCode Activity Heatmap" syncLabel={syncLabel} />
        </div>
        <div className="card p-5">
          <Heatmap logs={logs} weeks={20} title="Codeforces Activity Heatmap" />
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-ink-900">Questions solved (last 30 days)</h2>
          {liveCalendar.length > 0 ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">Live from LeetCode</span>
          ) : (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-ink-100 text-ink-500">Manual logs only</span>
          )}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#67738d' }} interval={4} />
            <YAxis tick={{ fontSize: 11, fill: '#67738d' }} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #eceef2', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {liveCalendar.length > 0 ? (
              <Bar dataKey="live" stackId="a" fill="#19a874" name="Solved (live)" radius={[4, 4, 0, 0]} />
            ) : (
              <>
                <Bar dataKey="easy" stackId="a" fill="#3cc590" name="Easy" />
                <Bar dataKey="medium" stackId="a" fill="#f59e0b" name="Medium" />
                <Bar dataKey="hard" stackId="a" fill="#ef4444" name="Hard" radius={[4, 4, 0, 0]} />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
        {liveCalendar.length > 0 && (
          <p className="text-xs text-ink-500 mt-2">
            Live data from LeetCode shows total submissions per day (difficulty split not available from the public API). Manual log entries fill gaps until the next sync.
          </p>
        )}
      </div>

      {lcData.length > 1 && (
        <div className="card p-5">
          <h2 className="font-semibold text-ink-900 mb-4">LeetCode growth over time</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={lcData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#67738d' }} />
              <YAxis tick={{ fontSize: 11, fill: '#67738d' }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #eceef2', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="total" stroke="#19a874" name="Total solved" strokeWidth={2} dot={{ r: 3 }} />
              {latestLc?.contest_rating && <Line type="monotone" dataKey="rating" stroke="#f59e0b" name="Contest rating" strokeWidth={2} dot={{ r: 3 }} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {cfData.length > 1 && (
        <div className="card p-5">
          <h2 className="font-semibold text-ink-900 mb-4">Codeforces growth over time</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={cfData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#67738d' }} />
              <YAxis tick={{ fontSize: 11, fill: '#67738d' }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #eceef2', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="rating" stroke="#3b82f6" name="Rating" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="solved" stroke="#19a874" name="Solved" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-semibold text-ink-900 mb-4">Topic coverage</h2>
        {topicMap.size === 0 ? (
          <p className="text-sm text-ink-400">No topics logged yet. Start logging to see your coverage map.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Array.from(topicMap.entries()).sort((a, b) => b[1].count - a[1].count).map(([name, info]) => {
              const intensity = Math.min(4, Math.floor(info.count / 5))
              const heatColors = ['bg-ink-100', 'bg-brand-100', 'bg-brand-200', 'bg-brand-300', 'bg-brand-500']
              return (
                <div key={name} className={`rounded-lg p-3 ${heatColors[intensity]} ${intensity >= 3 ? 'text-white' : 'text-ink-800'}`}>
                  <div className="text-sm font-medium">{name}</div>
                  <div className="text-xs opacity-80">{info.count} solved</div>
                  {info.last && <div className="text-[10px] opacity-60 mt-0.5">Last: {format(new Date(info.last), 'MMM d')}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {loading && <div className="text-center text-ink-400 text-sm">Loading…</div>}
    </div>
  )
}

function MetricCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${positive === undefined ? 'text-ink-900' : positive ? 'text-brand-600' : 'text-red-600'}`}>{value}</div>
      {sub && <div className="text-xs text-ink-500 mt-0.5">{sub}</div>}
    </div>
  )
}
