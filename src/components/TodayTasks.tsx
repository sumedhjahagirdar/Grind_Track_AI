import { useEffect, useState, useCallback } from 'react'
import { fetchPlanTasks, updatePlanTaskStatus, createPlanTask, deletePlanTask } from '../lib/api'
import type { PlanTask, TaskStatus } from '../lib/types'
import { CheckCircle2, Circle, AlertCircle, Trash2, Plus, ListChecks, Loader2 } from 'lucide-react'
import clsx from 'clsx'

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

const cycleTaskStatus = (current: TaskStatus): TaskStatus => {
  if (current === 'not_started') return 'in_progress'
  if (current === 'in_progress') return 'completed'
  return 'not_started'
}

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function TodayTasks() {
  const [tasks, setTasks] = useState<PlanTask[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')

  const load = useCallback(async () => {
    try {
      const all = await fetchPlanTasks()
      setTasks(all.filter((t) => t.kind === 'today' && t.scheduled_date <= todayStr()))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCycle = async (id: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)))
    await updatePlanTaskStatus(id, status)
  }

  const handleDelete = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await deletePlanTask(id)
  }

  const handleAdd = async () => {
    const text = newText.trim()
    if (!text || adding) return
    setAdding(true)
    try {
      await createPlanTask({ kind: 'today', text, scheduled_date: todayStr() })
      setNewText('')
      await load()
    } catch (e) {
      console.error(e)
    } finally {
      setAdding(false)
    }
  }

  const completedCount = tasks.filter((t) => t.status === 'completed').length

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-ink-900 flex items-center gap-2 text-sm">
          <ListChecks className="h-4 w-4 text-brand-600" />
          Today's Tasks
        </h3>
        {tasks.length > 0 && (
          <span className="text-[11px] text-ink-400">{completedCount}/{tasks.length} done</span>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a task for today..."
          className="input flex-1 text-sm py-1.5"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newText.trim()}
          className="flex-shrink-0 p-1.5 rounded-md bg-brand-500 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-600 transition"
          title="Add task"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-xs text-ink-400">No tasks for today yet. Add one above, or check the Roadmap page.</p>
      ) : (
        <div className="space-y-1">
          {tasks.map((t) => {
            const Icon = TASK_STATUS_ICON[t.status]
            const isOverdue = t.carried_over
            return (
              <div key={t.id} className="flex items-start gap-2 p-1.5 rounded-md hover:bg-ink-50 transition group">
                <button
                  onClick={() => handleCycle(t.id, cycleTaskStatus(t.status))}
                  className="flex-shrink-0 mt-0.5"
                  title={`Status: ${t.status} (click to cycle)`}
                >
                  <Icon className={clsx('h-4 w-4', TASK_STATUS_COLOR[t.status])} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className={clsx('text-sm', t.status === 'completed' ? 'text-ink-400 line-through' : 'text-ink-700')}>
                    {t.text}
                  </div>
                  {isOverdue && t.original_date && (
                    <div className="text-[10px] text-amber-600 mt-0.5">
                      Carried from {new Date(t.original_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(t.id)}
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
