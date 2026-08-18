import { supabase } from './supabase'
import type { DailyLog, Topic, LeetcodeSnapshot, CodeforcesSnapshot, Settings, ChatMessage } from './types'

const DEFAULT_OLLAMA_URL = 'http://localhost:11434'

const SYSTEM_PROMPT = `You are GrindTrack AI, an interactive study coach and mentor for a CS engineering student preparing for placements through DSA, LeetCode, and Codeforces.

You have access to the student's recent activity data (daily logs, topic progress, LeetCode and Codeforces snapshots, and their settings/goal) — this context is provided with each message.

CRITICAL — SOURCE OF TRUTH:
The student's free-text daily logs (provided below as "user's own daily log entries") are the PRIMARY source of truth about what they have actually studied, practiced, and accomplished. The structured tracker fields (topic statuses, solved counts) may be out of date or not yet updated — always reason from the raw log text first. If a log entry says they revised C++ STL or solved CodeChef problems, treat that as real progress even if the topic tracker still shows "not_started" or solved counts are zero.

If you notice the structured tracker data contradicts the daily logs (e.g., a log describes practicing a topic but the topic is still marked "not_started", or logs mention solving problems but solved counts are 0), briefly flag this to the student at the end of your response with a note like: "Note: your topic tracker / solved counts look out of date compared to your logs — consider updating them in the History or Settings page."

Your role:
- Answer questions about their progress, weak areas, and study strategy.
- Give specific, actionable advice — not generic platitudes.
- When they ask "what should I do today?", give concrete tasks with topic names and difficulty targets, building on what they actually did recently (per their logs).
- When they ask about their stats, reference the actual numbers from their data AND what their logs describe.
- Be encouraging but honest. If they're behind, say so and suggest a recovery plan.
- Keep responses concise — 3-6 sentences typically. Use bullet points for lists.
- You can ask follow-up questions to clarify their needs.
- Do NOT fabricate specific video titles, channel names, or URLs. Suggest search queries instead.`

interface OllamaChatResult {
  response: string
}

interface OllamaModel {
  name: string
}

function extractText(text: string): string {
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json|text)?\s*/i, '').replace(/```\s*$/, '')
  }
  return t
}

async function buildContext(settings: Settings | null): Promise<string> {
  const since = new Date()
  since.setDate(since.getDate() - 60)
  const sinceStr = since.toISOString().slice(0, 10)

  const [{ data: logs }, { data: topics }, { data: latestLc }, { data: latestCf }] = await Promise.all([
    supabase.from('daily_logs').select('*').gte('log_date', sinceStr).order('log_date', { ascending: false }).limit(60),
    supabase.from('topics').select('*').order('display_order', { ascending: true }),
    supabase.from('leetcode_snapshots').select('*').order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('codeforces_snapshots').select('*').order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
  ])

  const rawLogEntries = (logs as DailyLog[] ?? [])
    .slice()
    .reverse()
    .map((l) => {
      const parts: string[] = [`[${l.log_date}]`]
      const raw = (l.raw_input ?? '').trim()
      if (raw) parts.push(raw)
      const notes = (l.notes ?? '').trim()
      if (notes) parts.push(`(notes: ${notes})`)
      if (l.easy_solved || l.medium_solved || l.hard_solved) {
        parts.push(`(solved: ${l.easy_solved}E / ${l.medium_solved}M / ${l.hard_solved}H)`)
      }
      if (l.difficulty_rating) parts.push(`(difficulty: ${l.difficulty_rating})`)
      if (l.time_minutes) parts.push(`(time: ${l.time_minutes}min)`)
      return parts.join(' ')
    })
    .filter((s) => s.length > 12)

  const contextData = {
    goal: settings?.goal_text ?? 'placement-ready',
    target_date: settings?.target_date ?? null,
    leetcode_username: settings?.leetcode_username ?? null,
    codeforces_handle: settings?.codeforces_handle ?? null,
    user_daily_log_entries: rawLogEntries,
    log_summary: {
      total_logs: (logs ?? []).length,
      date_range: logs && logs.length > 0 ? `${logs[logs.length - 1].log_date} to ${logs[0].log_date}` : null,
    },
    structured_tracker: {
      topics: (topics as Topic[] ?? []).map((t) => ({
        name: t.name,
        status: t.status,
        questions_solved: t.questions_solved,
      })),
      leetcode_latest: latestLc as LeetcodeSnapshot | null,
      codeforces_latest: latestCf as CodeforcesSnapshot | null,
    },
  }

  return JSON.stringify(contextData, null, 2)
}

export async function sendOllamaChatMessage(
  message: string,
  settings: Settings | null,
  history: ChatMessage[],
): Promise<OllamaChatResult | { error: string }> {
  const baseUrl = (settings?.ollama_url || DEFAULT_OLLAMA_URL).replace(/\/+$/, '')
  const model = settings?.ollama_model

  if (!model) {
    return { error: 'No Ollama model selected. Set one in Settings.' }
  }

  let contextMsg: string
  try {
    contextMsg = await buildContext(settings)
  } catch (e) {
    console.error('Failed to build Ollama context:', e)
    contextMsg = '{}'
  }

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'user',
      content: `${message}\n\n---\n[Your context data — the user's own daily log entries below are the PRIMARY source of truth about their progress. Reason from the logs first, not the structured tracker.]\n${contextMsg}`,
    },
  ]

  let res: Response
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { temperature: 0.6 },
      }),
    })
  } catch (e) {
    const hint = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')
      ? 'Could not reach your local Ollama server. Make sure Ollama is running (try "ollama serve" in a terminal) and the URL in Settings matches.'
      : `Could not reach the Ollama server at ${baseUrl}.`
    return { error: hint }
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    if (res.status === 404) {
      return { error: `Model "${model}" not found. Pull it first with "ollama pull ${model}", or pick a different model in Settings.` }
    }
    return { error: `Ollama API error (${res.status}): ${errText.slice(0, 200)}` }
  }

  const data = await res.json().catch(() => null)
  const content = data?.message?.content
  if (!content) {
    return { error: 'Ollama returned an empty response. Try again or pick a different model.' }
  }

  return { response: extractText(content) }
}

export async function listOllamaModels(baseUrl: string): Promise<OllamaModel[] | { error: string }> {
  const url = (baseUrl || DEFAULT_OLLAMA_URL).replace(/\/+$/, '')
  try {
    const res = await fetch(`${url}/api/tags`)
    if (!res.ok) return { error: `Ollama API error (${res.status})` }
    const data = await res.json()
    return (data?.models ?? []) as OllamaModel[]
  } catch {
    return { error: 'Could not reach Ollama. Make sure it is running.' }
  }
}
