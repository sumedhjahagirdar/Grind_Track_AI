import { useEffect, useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { fetchDailyLogs, updateLog, deleteLog } from '../lib/api'
import type { DailyLog } from '../lib/types'
import { Search, Pencil, Trash2, X, Save, Loader2 } from 'lucide-react'

export default function History() {
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editEasy, setEditEasy] = useState(0)
  const [editMedium, setEditMedium] = useState(0)
  const [editHard, setEditHard] = useState(0)
  const [editTopics, setEditTopics] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const l = await fetchDailyLogs(365)
      setLogs(l)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return logs
    return logs.filter((l) =>
      l.raw_input?.toLowerCase().includes(q) ||
      l.topics?.some((t) => t.toLowerCase().includes(q)) ||
      l.log_date.includes(q) ||
      l.notes?.toLowerCase().includes(q),
    )
  }, [logs, query])

  const grouped = useMemo(() => {
    const m = new Map<string, DailyLog[]>()
    for (const l of filtered) {
      const arr = m.get(l.log_date) ?? []
      arr.push(l)
      m.set(l.log_date, arr)
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const startEdit = (l: DailyLog) => {
    setEditing(l.id)
    setEditText(l.raw_input)
    setEditEasy(l.easy_solved)
    setEditMedium(l.medium_solved)
    setEditHard(l.hard_solved)
    setEditTopics(l.topics.join(', '))
    setEditNotes(l.notes ?? '')
  }

  const cancelEdit = () => { setEditing(null); setEditText('') }

  const saveEdit = async (id: string) => {
    setSaving(true)
    try {
      const topics = editTopics.split(',').map((t) => t.trim()).filter(Boolean)
      await updateLog(id, {
        raw_input: editText,
        easy_solved: editEasy,
        medium_solved: editMedium,
        hard_solved: editHard,
        topics,
        notes: editNotes || null,
      })
      setEditing(null)
      await load()
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this log entry? This cannot be undone.')) return
    await deleteLog(id)
    await load()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-10 py-8 md:py-12 space-y-8 md:space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">History</h1>
        <p className="text-sm text-ink-500">All past daily logs — editable and searchable</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input pl-10"
          placeholder="Search by date, topic, or text…"
        />
      </div>

      <div className="space-y-4">
        {grouped.length === 0 && !loading && (
          <div className="card p-8 text-center text-ink-400 text-sm">
            No entries found. {query && 'Try a different search.'}
          </div>
        )}

        {grouped.map(([date, dateLogs]) => (
          <div key={date}>
            <div className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2 px-1">
              {format(new Date(date), 'EEEE, MMM d, yyyy')} · {dateLogs.length} entr{dateLogs.length === 1 ? 'y' : 'ies'}
            </div>
            <div className="space-y-3">
              {dateLogs.map((l) => (
                <div key={l.id} className="card p-4">
                  {editing === l.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-ink-800">Edit entry</div>
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit(l.id)} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            Save
                          </button>
                          <button onClick={cancelEdit} className="btn-ghost text-xs px-3 py-1.5">
                            <X className="h-3.5 w-3.5" /> Cancel
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="label">Raw input</label>
                        <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} className="input resize-none" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div><label className="label">Easy</label><input type="number" min={0} value={editEasy} onChange={(e) => setEditEasy(+e.target.value)} className="input" /></div>
                        <div><label className="label">Medium</label><input type="number" min={0} value={editMedium} onChange={(e) => setEditMedium(+e.target.value)} className="input" /></div>
                        <div><label className="label">Hard</label><input type="number" min={0} value={editHard} onChange={(e) => setEditHard(+e.target.value)} className="input" /></div>
                      </div>
                      <div><label className="label">Topics (comma-separated)</label><input type="text" value={editTopics} onChange={(e) => setEditTopics(e.target.value)} className="input" /></div>
                      <div><label className="label">Notes</label><input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="input" /></div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex gap-1.5">
                          {l.easy_solved > 0 && <span className="chip bg-brand-50 text-brand-700">{l.easy_solved} easy</span>}
                          {l.medium_solved > 0 && <span className="chip bg-amber-50 text-amber-700">{l.medium_solved} medium</span>}
                          {l.hard_solved > 0 && <span className="chip bg-red-50 text-red-700">{l.hard_solved} hard</span>}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(l)} className="btn-ghost text-xs px-2 py-1.5">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDelete(l.id)} className="btn-ghost text-xs px-2 py-1.5 text-red-500 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-ink-700 whitespace-pre-wrap">{l.raw_input}</p>
                      {l.topics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {l.topics.map((t, i) => <span key={i} className="chip bg-ink-100 text-ink-600">{t}</span>)}
                        </div>
                      )}
                      {l.notes && <p className="text-xs text-ink-500 mt-2 italic">{l.notes}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {loading && <div className="text-center text-ink-400 text-sm">Loading…</div>}
    </div>
  )
}
