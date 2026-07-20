import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import {
  generateRecommendations, fetchDailyLogs, fetchRecommendation,
  ensureTopicsSeeded, computeStreak, syncLeetcodeCalendar,
} from '../lib/api'
import type { DailyLog, Recommendation, RecommendationPayload } from '../lib/types'
import LogInput from '../components/LogInput'
import RecommendationCard from '../components/RecommendationCard'
import AIChat from '../components/AIChat'
import { Flame, TrendingUp, Target, Calendar, RefreshCw, Loader2 } from 'lucide-react'

export default function Dashboard() {
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [rec, setRec] = useState<Recommendation | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [syncingLc, setSyncingLc] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      await ensureTopicsSeeded()
      const [l, r] = await Promise.all([fetchDailyLogs(60), fetchRecommendation()])
      setLogs(l)
      setRec(r)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSaved = async () => {
    const l = await fetchDailyLogs(60)
    setLogs(l)
    setRegenerating(true)
    const result = await generateRecommendations()
    if ('payload' in result) {
      const r = await fetchRecommendation()
      setRec(r)
    }
    setRegenerating(false)
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    await generateRecommendations()
    const r = await fetchRecommendation()
    setRec(r)
    setRegenerating(false)
  }

  const handleSyncLc = async () => {
    setSyncingLc(true); setSyncMsg(null)
    const r = await syncLeetcodeCalendar()
    if (r.error) setSyncMsg(`Sync failed: ${r.error}`)
    else setSyncMsg(`Synced — ${r.submissions_synced} calendar days updated${r.snapshot_synced ? ', snapshot saved' : ''}`)
    setSyncingLc(false)
  }

  const streak = computeStreak(logs)

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const weekLogs = logs.filter((l) => new Date(l.log_date) >= weekStart)
  const weekEasy = weekLogs.reduce((s, l) => s + l.easy_solved, 0)
  const weekMedium = weekLogs.reduce((s, l) => s + l.medium_solved, 0)
  const weekHard = weekLogs.reduce((s, l) => s + l.hard_solved, 0)
  const weekTotal = weekEasy + weekMedium + weekHard

  const allTimeEasy = logs.reduce((s, l) => s + l.easy_solved, 0)
  const allTimeMedium = logs.reduce((s, l) => s + l.medium_solved, 0)
  const allTimeHard = logs.reduce((s, l) => s + l.hard_solved, 0)

  const payload: RecommendationPayload | null = rec?.payload ?? null
  const weekTargets = payload?.this_week?.question_targets
  const weekProgress = weekTargets ? Math.min(100, Math.round((weekTotal / (weekTargets.easy + weekTargets.medium + weekTargets.hard || 1)) * 100)) : 0

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Dashboard</h1>
          <p className="text-sm text-ink-500">{format(now, 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip bg-accent-500/10 text-accent-600">
            <Flame className="h-3.5 w-3.5" />
            {streak} day{streak === 1 ? '' : 's'}
          </span>
          <button onClick={handleSyncLc} disabled={syncingLc} className="btn-outline text-xs flex items-center gap-1.5">
            {syncingLc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync LeetCode
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className={`rounded-lg px-3 py-2 text-sm ${syncMsg.startsWith('Sync failed') ? 'bg-red-50 border border-red-100 text-red-700' : 'bg-brand-50 border border-brand-100 text-brand-700'}`}>
          {syncMsg}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="This week" value={weekTotal} sub={`${weekEasy}E / ${weekMedium}M / ${weekHard}H`} icon={<Target className="h-4 w-4" />} />
        <StatCard label="All-time solved" value={allTimeEasy + allTimeMedium + allTimeHard} sub={`${allTimeEasy}E / ${allTimeMedium}M / ${allTimeHard}H`} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Day streak" value={streak} sub={streak > 0 ? 'Keep it up!' : 'Log today to start'} icon={<Flame className="h-4 w-4" />} />
        <StatCard label="Logs total" value={logs.length} sub="entries logged" icon={<Calendar className="h-4 w-4" />} />
      </div>

      {weekTargets && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-ink-800">Weekly target progress</div>
            <div className="text-sm text-ink-500">{weekTotal} / {weekTargets.easy + weekTargets.medium + weekTargets.hard}</div>
          </div>
          <div className="h-2.5 bg-ink-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${weekProgress}%` }} />
          </div>
          <div className="mt-2 text-xs text-ink-500">
            Target: {weekTargets.easy} easy, {weekTargets.medium} medium, {weekTargets.hard} hard
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LogInput onSaved={handleSaved} existingLogs={logs} />
        <RecommendationCard rec={payload} generatedAt={rec?.generated_at} regenerating={regenerating} onRegenerate={handleRegenerate} />
      </div>

      <AIChat />

      {loading && <div className="text-center text-ink-400 text-sm">Loading…</div>}
    </div>
  )
}

function StatCard({ label, value, sub, icon }: { label: string; value: number; sub: string; icon: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-ink-400 mb-1">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-ink-900">{value}</div>
      <div className="text-xs text-ink-500 mt-0.5">{sub}</div>
    </div>
  )
}
