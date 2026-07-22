import { useEffect, useState } from 'react'
import { fetchSettings, upsertSettings, fetchDailyLogs, fetchLeetcodeSnapshots, fetchCodeforcesSnapshots, syncLeetcode, syncCodeforces } from '../lib/api'
import type { Settings as SettingsType } from '../lib/types'
import { Loader2, Download, Save, RefreshCw, Check } from 'lucide-react'

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [syncingLc, setSyncingLc] = useState(false)
  const [syncingCf, setSyncingCf] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [cfSyncMsg, setCfSyncMsg] = useState<string | null>(null)

  const [leetcodeUsername, setLeetcodeUsername] = useState('')
  const [codeforcesHandle, setCodeforcesHandle] = useState('')
  const [goalText, setGoalText] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [aiProvider, setAiProvider] = useState('gemini')
  const [reminderTime, setReminderTime] = useState('')

  useEffect(() => {
    fetchSettings().then((s) => {
      if (s) {
        setSettings(s)
        setLeetcodeUsername(s.leetcode_username ?? '')
        setCodeforcesHandle(s.codeforces_handle ?? '')
        setGoalText(s.goal_text ?? '')
        setTargetDate(s.target_date ?? '')
        setAiProvider(s.ai_provider ?? 'gemini')
        setReminderTime(s.daily_reminder_time ?? '')
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setSaved(false)
    await upsertSettings({
      leetcode_username: leetcodeUsername || null,
      codeforces_handle: codeforcesHandle || null,
      goal_text: goalText || null,
      target_date: targetDate || null,
      ai_provider: aiProvider,
      daily_reminder_time: reminderTime || null,
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSyncLc = async () => {
    setSyncingLc(true); setSyncMsg(null)
    if (!leetcodeUsername) { setSyncMsg('Set a username first'); setSyncingLc(false); return }
    const r = await syncLeetcode()
    if ('error' in r) setSyncMsg(`Error: ${r.error}`)
    else setSyncMsg('Synced successfully!')
    setSyncingLc(false)
  }

  const handleSyncCf = async () => {
    setSyncingCf(true); setCfSyncMsg(null)
    if (!codeforcesHandle) { setCfSyncMsg('Set a handle first'); setSyncingCf(false); return }
    const r = await syncCodeforces()
    if ('error' in r) setCfSyncMsg(`Error: ${r.error}`)
    else setCfSyncMsg('Synced successfully!')
    setSyncingCf(false)
  }

  const handleExport = async (format: 'json' | 'csv') => {
    const [logs, snapshots, cfSnapshots] = await Promise.all([fetchDailyLogs(10000), fetchLeetcodeSnapshots(10000), fetchCodeforcesSnapshots(10000)])
    let content: string
    let mime: string
    let ext: string

    if (format === 'json') {
      content = JSON.stringify({ logs, leetcode_snapshots: snapshots, codeforces_snapshots: cfSnapshots, settings }, null, 2)
      mime = 'application/json'; ext = 'json'
    } else {
      const headers = ['date', 'easy', 'medium', 'hard', 'topics', 'time_minutes', 'difficulty_rating', 'notes', 'raw_input']
      const rows = logs.map((l) => [
        l.log_date, l.easy_solved, l.medium_solved, l.hard_solved,
        `"${(l.topics || []).join('; ')}"`, l.time_minutes, l.difficulty_rating ?? '',
        `"${(l.notes ?? '').replace(/"/g, '""')}"`,
        `"${(l.raw_input ?? '').replace(/"/g, '""')}"`,
      ].join(','))
      content = [headers.join(','), ...rows].join('\n')
      mime = 'text/csv'; ext = 'csv'
    }

    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `grindtrack-export-${new Date().toISOString().slice(0, 10)}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-ink-400"><Loader2 className="h-5 w-5 animate-spin" /></div>

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-10 py-8 md:py-12 space-y-8 md:space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Settings</h1>
        <p className="text-sm text-ink-500">Configure your tracker and export your data</p>
      </div>

      <form onSubmit={handleSave} className="card p-5 space-y-4">
        <h2 className="font-semibold text-ink-900">Profile & Goals</h2>

        <div>
          <label className="label">LeetCode username</label>
          <input type="text" value={leetcodeUsername} onChange={(e) => setLeetcodeUsername(e.target.value)} className="input" placeholder="your_leetcode_handle" />
          <p className="text-[11px] text-ink-400 mt-1">Used to pull live stats from your public LeetCode profile.</p>
        </div>

        <div>
          <label className="label">Codeforces handle</label>
          <input type="text" value={codeforcesHandle} onChange={(e) => setCodeforcesHandle(e.target.value)} className="input" placeholder="your_cf_handle" />
          <p className="text-[11px] text-ink-400 mt-1">Used to pull live stats from your public Codeforces profile.</p>
        </div>

        <div>
          <label className="label">Learning goal</label>
          <input type="text" value={goalText} onChange={(e) => setGoalText(e.target.value)} className="input" placeholder="Placement-ready in 6 months" />
        </div>

        <div>
          <label className="label">Target date</label>
          <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="input max-w-[200px]" />
        </div>

        <div>
          <label className="label">AI provider</label>
          <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)} className="input max-w-[200px]">
            <option value="gemini">Gemini (Google)</option>
            <option value="claude">Claude (Anthropic)</option>
          </select>
          <p className="text-[11px] text-ink-400 mt-1">API keys are managed server-side and never exposed in the browser.</p>
        </div>

        <div>
          <label className="label">Daily reminder time (optional)</label>
          <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="input max-w-[160px]" />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save settings
          </button>
          {saved && <span className="text-sm text-brand-600 flex items-center gap-1"><Check className="h-4 w-4" /> Saved</span>}
        </div>
      </form>

      <div className="card p-5">
        <h2 className="font-semibold text-ink-900 mb-2">LeetCode Sync</h2>
        <p className="text-sm text-ink-500 mb-3">Pull your latest public profile stats (solved counts, acceptance rate, contest rating).</p>
        <button onClick={handleSyncLc} disabled={syncingLc || !leetcodeUsername} className="btn-outline">
          {syncingLc ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync LeetCode
        </button>
        {syncMsg && <p className="text-sm mt-2 text-ink-600">{syncMsg}</p>}
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-ink-900 mb-2">Codeforces Sync</h2>
        <p className="text-sm text-ink-500 mb-3">Pull your latest Codeforces stats (rating, max rating, solved count, contest count).</p>
        <button onClick={handleSyncCf} disabled={syncingCf || !codeforcesHandle} className="btn-outline">
          {syncingCf ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync Codeforces
        </button>
        {cfSyncMsg && <p className="text-sm mt-2 text-ink-600">{cfSyncMsg}</p>}
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-ink-900 mb-2">Export your data</h2>
        <p className="text-sm text-ink-500 mb-3">Your data is yours. Download all logs and snapshots at any time.</p>
        <div className="flex gap-2">
          <button onClick={() => handleExport('json')} className="btn-outline">
            <Download className="h-4 w-4" /> JSON
          </button>
          <button onClick={() => handleExport('csv')} className="btn-outline">
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>
    </div>
  )
}
