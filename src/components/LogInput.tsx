import { useState } from 'react'
import { parseAndSaveLog } from '../lib/api'
import { format } from 'date-fns'
import { Send, FileText, MessageSquare, Loader2 } from 'lucide-react'
import type { DailyLog } from '../lib/types'

interface Props {
  onSaved: () => void
  existingLogs: DailyLog[]
}

export default function LogInput({ onSaved, existingLogs }: Props) {
  const [mode, setMode] = useState<'chat' | 'form'>('chat')
  const [text, setText] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parseWarning, setParseWarning] = useState<string | null>(null)

  const [fEasy, setFEasy] = useState(0)
  const [fMedium, setFMedium] = useState(0)
  const [fHard, setFHard] = useState(0)
  const [fTopics, setFTopics] = useState('')
  const [fTime, setFTime] = useState(0)
  const [fDifficulty, setFDifficulty] = useState(0)
  const [fNotes, setFNotes] = useState('')

  const existing = existingLogs.find((l) => l.log_date === date)
  const countForDate = existingLogs.filter((l) => l.log_date === date).length

  const handleChatSubmit = async () => {
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    setParseWarning(null)
    const result = await parseAndSaveLog(text, date)
    setLoading(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      if (result.parse_error) {
        setParseWarning(`Saved, but AI parsing failed: ${result.parse_error}. Structured counts may be zero — edit in History to fix.`)
      }
      setText('')
      onSaved()
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setParseWarning(null)
    const topics = fTopics.split(',').map((t) => t.trim()).filter(Boolean)
    const syntheticText = `Date: ${date}. Solved ${fEasy} easy, ${fMedium} medium, ${fHard} hard LeetCode questions. Topics: ${topics.join(', ') || 'none'}. Time: ${fTime} minutes. Difficulty rating: ${fDifficulty}/5. Notes: ${fNotes}`
    const result = await parseAndSaveLog(syntheticText, date)
    setLoading(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      if (result.parse_error) {
        setParseWarning(`Saved, but AI parsing failed: ${result.parse_error}.`)
      }
      setFEasy(0); setFMedium(0); setFHard(0); setFTopics(''); setFTime(0); setFDifficulty(0); setFNotes('')
      onSaved()
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-ink-900 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-brand-600" />
          Today's Log
        </h2>
        <div className="flex bg-ink-100 dark:bg-white/5 rounded-lg p-0.5">
          <button
            onClick={() => setMode('chat')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${mode === 'chat' ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-ink-50' : 'text-ink-500 dark:text-ink-400'}`}
          >
            Chat
          </button>
          <button
            onClick={() => setMode('form')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${mode === 'form' ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-ink-50' : 'text-ink-500 dark:text-ink-400'}`}
          >
            Form
          </button>
        </div>
      </div>

      <div className="mb-3">
        <label className="label">Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input max-w-[180px]" />
        {countForDate > 0 && <p className="text-xs text-ink-500 mt-1">You have {countForDate} entr{countForDate === 1 ? 'y' : 'ies'} for this date. A new entry will be added.</p>}
      </div>

      {mode === 'chat' ? (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="input resize-none"
            placeholder="Today I solved 3 easy and 4 medium LeetCode questions on Arrays and Strings. Started learning DSA from a YouTube channel, watched 2 videos on recursion. Felt Sliding Window was tough."
            disabled={loading}
          />
          {error && <div className="mt-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-800/50 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
          {parseWarning && !error && <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">{parseWarning}</div>}
          <button onClick={handleChatSubmit} disabled={loading || !text.trim()} className="btn-primary mt-3 w-full">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Parsing with AI…</> : <><Send className="h-4 w-4" /> Log it</>}
          </button>
          <p className="mt-2 text-[11px] text-ink-400">AI will parse your text into structured data. You can edit it later in History.</p>
        </div>
      ) : (
        <form onSubmit={handleFormSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label">Easy</label>
              <input type="number" min={0} value={fEasy} onChange={(e) => setFEasy(+e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Medium</label>
              <input type="number" min={0} value={fMedium} onChange={(e) => setFMedium(+e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Hard</label>
              <input type="number" min={0} value={fHard} onChange={(e) => setFHard(+e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Topics (comma-separated)</label>
            <input type="text" value={fTopics} onChange={(e) => setFTopics(e.target.value)} className="input" placeholder="Arrays, Strings, Sliding Window" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Time (min)</label>
              <input type="number" min={0} value={fTime} onChange={(e) => setFTime(+e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Difficulty (1-5)</label>
              <input type="number" min={0} max={5} value={fDifficulty} onChange={(e) => setFDifficulty(+e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2} className="input resize-none" />
          </div>
          {error && <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-800/50 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
          {parseWarning && !error && <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">{parseWarning}</div>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><FileText className="h-4 w-4" /> Save entry</>}
          </button>
        </form>
      )}
    </div>
  )
}
