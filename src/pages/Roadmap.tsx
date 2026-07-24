import { useEffect, useState, useCallback } from 'react'
import {
  fetchTopics, updateTopic, fetchPlanTasks, updatePlanTaskStatus,
  createPlanTask, deletePlanTask, generateRecommendations, runDailyCarryOver, recomputeTopicTotals,
} from '../lib/api'
import { topicCoveragePercent } from '../lib/topicTotals'
import type { Topic, PlanTask, TopicStatus, TaskStatus, PlanKind } from '../lib/types'
import {
  CheckCircle2, Circle, Loader2, RefreshCw, Plus, Trash2, AlertCircle, CalendarDays, CalendarRange, CalendarCheck, Calendar,
} from 'lucide-react'
import clsx from 'clsx'

const STATUS_LABELS: Record<TopicStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  practiced: 'Practiced',
  mastered: 'Mastered',
}

const STATUS_DOT: Record<TopicStatus, string> = {
  not_started: 'bg-ink-300',
  in_progress: 'bg-amber-400',
  practiced: 'bg-blue-400',
  mastered: 'bg-brand-500',
}

const TASK_STATUS_ICON: Record<TaskStatus, typeof CheckCircle2> = {
  not_started: Circle,
  in_progress: AlertCircle,
  completed: CheckCircle2,
}

const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  not_started: 'text-ink-300',
  in_progress: 'text-amber-500',
  completed: 'text-brand-500',
}

const todayStr = () => new Date().toISOString().slice(0, 10)
const tomorrowStr = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export default function Roadmap() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [tasks, setTasks] = useState<PlanTask[]>([])
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError] = useState<string | null>(null)
  const [carryMsg, setCarryMsg] = useState<string | null>(null)
  const [missedDays, setMissedDays] = useState(0)
  const [newTask, setNewTask] = useState<{ kind: PlanKind; text: string }>({ kind: 'today', text: '' })
  const [recomputingTopics, setRecomputingTopics] = useState(false)
  const [recomputeMsg, setRecomputeMsg] = useState<string | null>(null)
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Run carry-over first, then load
      const carry = await runDailyCarryOver()
      if ('error' in carry) {
        console.error('Carry-over failed:', carry.error)
      } else {
        if (carry.message) {
          setCarryMsg(carry.message)
          setMissedDays(carry.missed_days)
        } else {
          setCarryMsg(null)
          setMissedDays(0)
        }
      }
      const [t, p] = await Promise.all([fetchTopics(), fetchPlanTasks()])
      setTopics(t)
      setTasks(p)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleStatusChange = async (id: string, status: TopicStatus) => {
    await updateTopic(id, { status })
    setTopics((prev) => prev.map((t) => t.id === id ? { ...t, status } : t))
  }

  const startEditSolved = (t: Topic) => {
    setEditingTopicId(t.id)
    setEditValue(String(t.questions_solved))
  }

  const saveEditSolved = async (id: string) => {
    const n = Math.max(0, parseInt(editValue, 10) || 0)
    setEditingTopicId(null)
    await updateTopic(id, { questions_solved: n })
    setTopics((prev) => prev.map((t) => t.id === id ? { ...t, questions_solved: n } : t))
  }

  const handleRecomputeTopics = async () => {
    setRecomputingTopics(true)
    setRecomputeMsg(null)
    try {
      const result = await recomputeTopicTotals()
      if ('error' in result) {
        setRecomputeMsg(`Failed: ${result.error}`)
      } else {
        setRecomputeMsg(`Fixed — ${result.topics_updated} topics recalculated from your log history.`)
        const freshTopics = await fetchTopics()
        setTopics(freshTopics)
      }
    } catch (e) {
      setRecomputeMsg(e instanceof Error ? e.message : 'Failed to recompute')
    } finally {
      setRecomputingTopics(false)
    }
  }

  const handleTaskStatusChange = async (id: string, status: TaskStatus) => {
    await updatePlanTaskStatus(id, status)
    setTasks((prev) => prev.map((p) => p.id === id ? {
      ...p,
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    } : p))
  }

  const cycleTaskStatus = (current: TaskStatus): TaskStatus => {
    if (current === 'not_started') return 'in_progress'
    if (current === 'in_progress') return 'completed'
    return 'not_started'
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    setRegenError(null)
    const result = await generateRecommendations()
    if ('error' in result) {
      setRegenError(result.error)
      setRegenerating(false)
      return
    }
    await load()
    setRegenerating(false)
  }

  const handleAddTask = async () => {
    if (!newTask.text.trim()) return
    const scheduled = newTask.kind === 'tomorrow' ? tomorrowStr() : todayStr()
    await createPlanTask({ kind: newTask.kind, text: newTask.text.trim(), scheduled_date: scheduled })
    setNewTask({ kind: 'today', text: '' })
    const p = await fetchPlanTasks()
    setTasks(p)
  }

  const handleDeleteTask = async (id: string) => {
    await deletePlanTask(id)
    setTasks((prev) => prev.filter((p) => p.id !== id))
  }

  const todayTasks = tasks.filter((t) => t.kind === 'today' && t.scheduled_date <= todayStr())
  const tomorrowTasks = tasks.filter((t) => t.kind === 'tomorrow')
  const weekTasks = tasks.filter((t) => t.kind === 'this_week')
  const monthTasks = tasks.filter((t) => t.kind === 'this_month')

  // Weekly pace recompute: how many questions done this week vs. target, remaining days
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const daysRemainingInWeek = Math.max(1, Math.ceil((weekEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
  const weekCompletedCount = weekTasks.filter((t) => t.status === 'completed').length
  const weekTotalCount = weekTasks.length
  const weekRemaining = Math.max(0, weekTotalCount - weekCompletedCount)
  const perDayPace = Math.ceil(weekRemaining / daysRemainingInWeek)

  const statusCounts = topics.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc }, {} as Record<string, number>)

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-10 py-8 md:py-12 space-y-8 md:space-y-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Roadmap</h1>
          <p className="text-sm text-ink-500">Today, tomorrow, this week, this month — auto-rescheduled</p>
        </div>
        <button onClick={handleRegenerate} disabled={regenerating} className="btn-outline">
          {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {regenerating ? 'Generating your plan…' : 'Regenerate plan'}
        </button>
      </div>

      {regenError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium">Failed to generate plan</div>
            <div className="text-xs mt-0.5 text-red-600 dark:text-red-400">{regenError}</div>
          </div>
        </div>
      )}

      {regenerating && (
        <div className="rounded-lg bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-700/50 px-4 py-3 text-sm text-brand-700 dark:text-brand-300 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating your plan from the AI engine…
        </div>
      )}

      {carryMsg && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium">{carryMsg}</div>
            {missedDays > 1 && (
              <div className="text-xs mt-0.5 text-amber-700 dark:text-amber-400">
                Weekly pace adjusted: {perDayPace} task{perDayPace === 1 ? '' : 's'}/day needed across {daysRemainingInWeek} remaining day{daysRemainingInWeek === 1 ? '' : 's'} to hit this week's target.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        {(['not_started', 'in_progress', 'practiced', 'mastered'] as TopicStatus[]).map((s) => (
          <div key={s} className="card p-3 text-center">
            <div className={clsx('h-2 w-2 rounded-full mx-auto mb-1.5', STATUS_DOT[s])} />
            <div className="text-xl font-bold text-ink-900">{statusCounts[s] || 0}</div>
            <div className="text-[11px] text-ink-500">{STATUS_LABELS[s]}</div>
          </div>
        ))}
      </div>

      {/* Add task */}
      <div className="card p-3 flex flex-wrap gap-2 items-center">
        <select
          value={newTask.kind}
          onChange={(e) => setNewTask({ ...newTask, kind: e.target.value as PlanKind })}
          className="text-xs border border-ink-200 dark:border-ink-700 rounded-md px-2 py-1.5 bg-white dark:bg-ink-900 text-ink-700 dark:text-ink-100 focus:outline-none focus:border-brand-500"
        >
          <option value="today">Today</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="this_week">This Week</option>
          <option value="this_month">This Month</option>
        </select>
        <input
          type="text"
          value={newTask.text}
          onChange={(e) => setNewTask({ ...newTask, text: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
          placeholder="Add a task..."
          className="flex-1 min-w-[200px] text-sm border border-ink-200 dark:border-ink-700 rounded-md px-3 py-1.5 bg-white dark:bg-ink-900 text-ink-800 dark:text-ink-100 focus:outline-none focus:border-brand-500"
        />
        <button onClick={handleAddTask} className="btn-outline text-xs flex items-center gap-1">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TaskSection
          title="Today"
          icon={<CalendarCheck className="h-4 w-4" />}
          tasks={todayTasks}
          onCycle={handleTaskStatusChange}
          onDelete={handleDeleteTask}
          cycle={cycleTaskStatus}
          accent="brand"
          emptyText="No tasks for today. Add one above or regenerate your plan."
        />
        <TaskSection
          title="Tomorrow"
          icon={<Calendar className="h-4 w-4" />}
          tasks={tomorrowTasks}
          onCycle={handleTaskStatusChange}
          onDelete={handleDeleteTask}
          cycle={cycleTaskStatus}
          accent="sky"
          emptyText="Tomorrow's plan will appear here after you regenerate."
        />
        <TaskSection
          title="This Week"
          icon={<CalendarDays className="h-4 w-4" />}
          tasks={weekTasks}
          onCycle={handleTaskStatusChange}
          onDelete={handleDeleteTask}
          cycle={cycleTaskStatus}
          accent="amber"
          emptyText="Weekly targets appear after you regenerate your plan."
          progress={weekTotalCount > 0 ? { completed: weekCompletedCount, total: weekTotalCount, perDayPace } : undefined}
        />
        <TaskSection
          title="This Month"
          icon={<CalendarRange className="h-4 w-4" />}
          tasks={monthTasks}
          onCycle={handleTaskStatusChange}
          onDelete={handleDeleteTask}
          cycle={cycleTaskStatus}
          accent="violet"
          emptyText="Monthly milestones appear after you regenerate your plan."
        />
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-ink-900">DSA Syllabus Checklist</h2>
            <p className="text-[11px] text-ink-400 mt-0.5">Coverage % uses real LeetCode tag totals. Click the "X solved" number to set it manually — daily logs will keep adding to it automatically after that.</p>
          </div>
          <button
            onClick={handleRecomputeTopics}
            disabled={recomputingTopics}
            title="Rebuild topic totals fairly from your log history"
            className="btn-outline text-xs px-2.5 py-1.5 flex-shrink-0"
          >
            {recomputingTopics ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Fix totals
          </button>
        </div>
        {recomputeMsg && <div className="text-xs text-brand-600 dark:text-brand-400 mb-3">{recomputeMsg}</div>}
        <div className="space-y-2">
          {topics.map((t) => {
            const pct = topicCoveragePercent(t.name, t.questions_solved)
            return (
              <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-ink-50 dark:hover:bg-white/5 transition">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={clsx('h-2.5 w-2.5 rounded-full flex-shrink-0', STATUS_DOT[t.status])} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-900">{t.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-1.5 flex-1 max-w-[140px] rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }} />
                      </div>
                      <span className="text-xs text-ink-400 flex-shrink-0">
                        {pct < 1 && pct > 0 ? '<1' : pct.toFixed(0)}%
                      </span>
                      {editingTopicId === t.id ? (
                        <input
                          type="number"
                          min={0}
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveEditSolved(t.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditSolved(t.id); if (e.key === 'Escape') setEditingTopicId(null) }}
                          className="w-14 text-xs border border-brand-400 rounded px-1 py-0.5 bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-100 focus:outline-none flex-shrink-0"
                        />
                      ) : (
                        <button
                          onClick={() => startEditSolved(t)}
                          title="Click to manually set solved count"
                          className="text-xs text-ink-400 hover:text-brand-600 dark:hover:text-brand-400 underline decoration-dotted underline-offset-2 flex-shrink-0"
                        >
                          {t.questions_solved} solved
                        </button>
                      )}
                      {t.last_practiced_at && <span className="text-xs text-ink-400 flex-shrink-0">· last {new Date(t.last_practiced_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
                <select
                  value={t.status}
                  onChange={(e) => handleStatusChange(t.id, e.target.value as TopicStatus)}
                  className="text-xs border border-ink-200 dark:border-ink-700 rounded-md px-2 py-1 bg-white dark:bg-ink-900 text-ink-700 dark:text-ink-100 focus:outline-none focus:border-brand-500 flex-shrink-0 ml-3"
                >
                  {(Object.keys(STATUS_LABELS) as TopicStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      </div>

      {loading && <div className="text-center text-ink-400 text-sm">Loading…</div>}
    </div>
  )
}

function TaskSection({
  title, icon, tasks, onCycle, onDelete, cycle, accent, emptyText, progress,
}: {
  title: string
  icon: React.ReactNode
  tasks: PlanTask[]
  onCycle: (id: string, status: TaskStatus) => void
  onDelete: (id: string) => void
  cycle: (current: TaskStatus) => TaskStatus
  accent: 'brand' | 'sky' | 'amber' | 'violet'
  emptyText: string
  progress?: { completed: number; total: number; perDayPace: number }
}) {
  const colors = {
    brand: 'border-brand-200 dark:border-brand-700/60 bg-brand-50/30 dark:bg-brand-950/20',
    sky: 'border-sky-200 dark:border-sky-700/60 bg-sky-50/30 dark:bg-sky-950/20',
    amber: 'border-amber-200 dark:border-amber-700/60 bg-amber-50/30 dark:bg-amber-950/20',
    violet: 'border-violet-200 dark:border-violet-700/60 bg-violet-50/30 dark:bg-violet-950/20',
  }
  const iconBg = {
    brand: 'bg-brand-100 text-brand-700 dark:bg-brand-800/50 dark:text-brand-200',
    sky: 'bg-sky-100 text-sky-700 dark:bg-sky-800/50 dark:text-sky-200',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-800/50 dark:text-amber-200',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-800/50 dark:text-violet-200',
  }
  return (
    <div className={clsx('card p-4 border-l-4', colors[accent])}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={clsx('flex h-7 w-7 items-center justify-center rounded-lg', iconBg[accent])}>{icon}</div>
          <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        </div>
        {progress && (
          <span className="text-xs text-ink-500">{progress.completed}/{progress.total} done</span>
        )}
      </div>

      {progress && progress.total > 0 && (
        <div className="mb-3">
          <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (progress.completed / progress.total) * 100)}%` }}
            />
          </div>
          <div className="text-[11px] text-ink-500 mt-1">
            {progress.perDayPace} task{progress.perDayPace === 1 ? '' : 's'}/day to stay on pace
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="text-xs text-ink-400">{emptyText}</p>
      ) : (
        <div className="space-y-1.5">
          {tasks.map((it) => {
            const Icon = TASK_STATUS_ICON[it.status]
            const isOverdue = it.carried_over && it.kind === 'today'
            return (
              <div key={it.id} className="flex items-start gap-2 w-full text-left p-1.5 rounded-md hover:bg-ink-50 dark:hover:bg-white/5 transition group">
                <button
                  onClick={() => onCycle(it.id, cycle(it.status))}
                  className="flex-shrink-0 mt-0.5"
                  title={`Status: ${it.status} (click to cycle)`}
                >
                  <Icon className={clsx('h-4 w-4', TASK_STATUS_COLOR[it.status])} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className={clsx('text-sm', it.status === 'completed' ? 'text-ink-400 line-through' : 'text-ink-700')}>
                    {it.text}
                  </div>
                  {isOverdue && it.original_date && (
                    <div className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
                      <AlertCircle className="h-2.5 w-2.5" />
                      Overdue — carried from {new Date(it.original_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onDelete(it.id)}
                  className="opacity-0 group-hover:opacity-100 text-ink-300 hover:text-red-500 transition flex-shrink-0"
                  title="Remove task"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
