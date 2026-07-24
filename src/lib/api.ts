import { supabase, FUNCTIONS_URL } from './supabase'
import type {
  DailyLog, LeetcodeSnapshot, CodeforcesSnapshot, ChatMessage,
  Recommendation, Topic, PlanItem, PlanTask, TaskStatus, Settings,
  RecommendationPayload, ParsedLog,
  LeetcodeCalendarEntry, LeetcodeSyncLogEntry, CarryOverResult,
} from './types'
import { CANONICAL_TOPICS } from './types'

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export async function parseAndSaveLog(text: string, date?: string): Promise<{ parsed: ParsedLog; log: DailyLog; parse_error?: string | null } | { error: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${FUNCTIONS_URL}/parse-log`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, date }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: body.error || `Request failed (${res.status})` }
  }
  const data = await res.json()
  return { parsed: data.parsed, log: data.log, parse_error: data.parse_error ?? null }
}

export async function generateRecommendations(): Promise<{ payload: RecommendationPayload } | { error: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${FUNCTIONS_URL}/recommendations`, {
    method: 'POST',
    headers,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: body.error || `Request failed (${res.status})` }
  }
  return await res.json()
}

export async function syncLeetcode(): Promise<{ snapshot: LeetcodeSnapshot } | { error: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${FUNCTIONS_URL}/leetcode-sync`, {
    method: 'POST',
    headers,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: body.error || `Request failed (${res.status})` }
  }
  return await res.json()
}

export async function syncCodeforces(): Promise<{ snapshot: CodeforcesSnapshot } | { error: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${FUNCTIONS_URL}/codeforces-sync`, {
    method: 'POST',
    headers,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: body.error || `Request failed (${res.status})` }
  }
  return await res.json()
}

export async function sendChatMessage(message: string): Promise<{ response: string } | { error: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${FUNCTIONS_URL}/ai-chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: body.error || `Request failed (${res.status})` }
  }
  return await res.json()
}

export async function fetchChatMessages(limit = 50): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as ChatMessage[]
}

export async function clearChatMessages(): Promise<void> {
  const { error } = await supabase.from('chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw error
}

export async function fetchDailyLogs(limit = 90): Promise<DailyLog[]> {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .order('log_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as DailyLog[]
}

export async function updateLog(id: string, updates: Partial<DailyLog>): Promise<void> {
  const { error } = await supabase.from('daily_logs').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteLog(id: string): Promise<void> {
  const { error } = await supabase.from('daily_logs').delete().eq('id', id)
  if (error) throw error
}

export async function fetchRecommendation(): Promise<Recommendation | null> {
  const { data, error } = await supabase
    .from('recommendations')
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data as Recommendation | null
}

export async function fetchTopics(): Promise<Topic[]> {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .order('display_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as Topic[]
}

export async function ensureTopicsSeeded(): Promise<void> {
  const existing = await fetchTopics()
  if (existing.length > 0) return
  const rows = CANONICAL_TOPICS.map((name, i) => ({ name, display_order: i }))
  const { error } = await supabase.from('topics').insert(rows)
  if (error) throw error
}

export async function updateTopic(id: string, updates: Partial<Topic>): Promise<void> {
  const { error } = await supabase.from('topics').update(updates).eq('id', id)
  if (error) throw error
}

export async function fetchPlanItems(): Promise<PlanItem[]> {
  const { data, error } = await supabase
    .from('plan_items')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as PlanItem[]
}

export async function togglePlanItem(id: string, completed: boolean): Promise<void> {
  const { error } = await supabase
    .from('plan_items')
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw error
}

export async function fetchSettings(): Promise<Settings | null> {
  const { data, error } = await supabase.from('settings').select('*').maybeSingle()
  if (error) throw error
  return data as Settings | null
}

export async function upsertSettings(s: Partial<Settings>): Promise<void> {
  const { error } = await supabase.from('settings').upsert(s, { onConflict: 'user_id' })
  if (error) throw error
}

export async function fetchLeetcodeSnapshots(limit = 90): Promise<LeetcodeSnapshot[]> {
  const { data, error } = await supabase
    .from('leetcode_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as LeetcodeSnapshot[]
}

export async function fetchCodeforcesSnapshots(limit = 90): Promise<CodeforcesSnapshot[]> {
  const { data, error } = await supabase
    .from('codeforces_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as CodeforcesSnapshot[]
}

export function computeStreak(logs: DailyLog[]): number {
  if (logs.length === 0) return 0
  const dates = new Set(logs.map((l) => l.log_date))
  let streak = 0
  const d = new Date()
  const todayStr = d.toISOString().slice(0, 10)
  if (!dates.has(todayStr)) {
    d.setDate(d.getDate() - 1)
  }
  while (true) {
    const s = d.toISOString().slice(0, 10)
    if (dates.has(s)) {
      streak++
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

// ---------- Plan Tasks (Adaptive Roadmap) ----------

export async function fetchPlanTasks(): Promise<PlanTask[]> {
  const { data, error } = await supabase
    .from('plan_tasks')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as PlanTask[]
}

export async function createPlanTask(task: { kind: PlanTask['kind']; text: string; scheduled_date?: string }): Promise<PlanTask | null> {
  const { data, error } = await supabase
    .from('plan_tasks')
    .insert({
      kind: task.kind,
      text: task.text,
      scheduled_date: task.scheduled_date ?? new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()
  if (error) throw error
  return data as PlanTask
}

export async function updatePlanTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const updates: Partial<PlanTask> = { status }
  if (status === 'completed') updates.completed_at = new Date().toISOString()
  else updates.completed_at = null
  const { error } = await supabase.from('plan_tasks').update(updates).eq('id', id)
  if (error) throw error
}

export async function deletePlanTask(id: string): Promise<void> {
  const { error } = await supabase.from('plan_tasks').delete().eq('id', id)
  if (error) throw error
}

export async function runDailyCarryOver(): Promise<CarryOverResult | { error: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${FUNCTIONS_URL}/daily-carryover`, { method: 'POST', headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: body.error || `Request failed (${res.status})` }
  }
  return await res.json() as CarryOverResult
}

export async function recomputeTopicTotals(): Promise<{ topics_updated: number } | { error: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${FUNCTIONS_URL}/recompute-topics`, { method: 'POST', headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: body.error || `Request failed (${res.status})` }
  }
  return await res.json()
}

// ---------- LeetCode live calendar + sync ----------

export async function fetchLeetcodeCalendar(limit = 400): Promise<LeetcodeCalendarEntry[]> {
  const { data, error } = await supabase
    .from('leetcode_submission_calendar')
    .select('date, submission_count')
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as LeetcodeCalendarEntry[]
}

export async function fetchLeetcodeSyncLog(limit = 5): Promise<LeetcodeSyncLogEntry[]> {
  const { data, error } = await supabase
    .from('leetcode_sync_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as LeetcodeSyncLogEntry[]
}

export async function syncLeetcodeCalendar(): Promise<{ submissions_synced: number; snapshot_synced: boolean; error?: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${FUNCTIONS_URL}/leetcode-sync`, { method: 'POST', headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { submissions_synced: 0, snapshot_synced: false, error: body.error || `Request failed (${res.status})` }
  }
  return await res.json()
}
