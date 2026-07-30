import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Fixed topic sequence, agreed with the user — replaces open-ended AI topic
// choice, which was causing it to circle back to already-comfortable topics
// (Arrays & Strings, Linked Lists) instead of covering new ground. Arrays &
// Strings is intentionally excluded — it was already underway before this
// schedule was adopted, so it isn't part of the forward sequence.
const TOPIC_ORDER = [
  "Linked Lists",
  "Recursion & Backtracking",
  "Trees",
  "Binary Search",
  "Sliding Window / Two Pointers",
  "Stacks & Queues",
  "Heaps / Priority Queues",
  "Graphs",
  "Dynamic Programming",
  "Greedy Algorithms",
  "Sorting Algorithms",
  "Bit Manipulation",
  "Tries",
  "Math / Number Theory",
];
const TOPIC_DONE_THRESHOLD = 5; // questions_solved to consider a topic "covered for this pass"

function computeTopicSchedule(topicMap: { name: string; questions_solved: number }[]) {
  const solvedByName = new Map(topicMap.map((t) => [t.name, t.questions_solved || 0]));
  const focusIndex = TOPIC_ORDER.findIndex((name) => (solvedByName.get(name) || 0) < TOPIC_DONE_THRESHOLD);
  const focus_topic = focusIndex === -1 ? "All scheduled topics covered — move to Hard problems and mock interviews" : TOPIC_ORDER[focusIndex];
  const up_next_topics = focusIndex === -1 ? [] : TOPIC_ORDER.slice(focusIndex + 1, focusIndex + 4);
  return { focus_topic, up_next_topics, full_order: TOPIC_ORDER };
}

const SYSTEM_PROMPT = `You are an AI study-planning engine for a CS engineering student preparing for placements through DSA and LeetCode.

You receive:
- The user's recent daily logs (last 30-60 days) — including their RAW free-text log entries (the "user_daily_log_entries" field), which are the PRIMARY source of truth about what they have actually studied and accomplished.
- A topic-coverage map with statuses and question counts (the "structured_tracker" field) — this may be out of date; always reason from the raw logs first.
- The user's stated goal and target date
- Their latest LeetCode and Codeforces public profile stats

CRITICAL — TOPIC SEQUENCING:
The user follows a fixed, agreed-upon topic order (provided in the "topic_schedule" field of the input). This is not a suggestion — it exists specifically because leaving topic choice open-ended led to circling back to comfortable topics (Arrays, Linked Lists) instead of covering new ground.
- "focus_topic" is the topic they should be actively working RIGHT NOW. tomorrow.topics_to_practice and this_week.topics_to_finish MUST center on focus_topic. You may include at most ONE revision problem from an earlier-covered topic if the logs show they're struggling with it — everything else must be focus_topic.
- "up_next_topics" is the order to progress through after focus_topic is sufficiently covered (5+ questions solved). this_month.roadmap should walk through these in order, not jump around.
- Do NOT recommend topics outside focus_topic / up_next_topics unless the user's raw logs explicitly show them asking about or working on something else — if so, treat that as a deliberate detour, mention it, but steer back to focus_topic for the following day.

CRITICAL — SOURCE OF TRUTH:
The user's free-text daily logs are the PRIMARY source of truth. If a log entry says they revised C++ STL or solved CodeChef problems, treat that as real progress even if the topic tracker shows "not_started" or solved counts are zero. Build your recommendations on what they actually did (per logs), not just the structured counters.

Produce a JSON plan in EXACTLY this shape:
{
  "tomorrow": {
    "leetcode_targets": {"easy": number, "medium": number, "hard": number},
    "topics_to_practice": string[],
    "learning_tasks": string[]
  },
  "this_week": {
    "topics_to_finish": string[],
    "question_targets": {"easy": number, "medium": number, "hard": number},
    "milestone": string
  },
  "this_month": {
    "roadmap": string[],
    "estimated_readiness": "on track" | "behind" | "ahead" | "at risk"
  },
  "weak_areas": string[],
  "strengths": string[],
  "suggested_resources": [{"topic": string, "type": string, "suggestion": string}]
}

Rules:
- Be specific and actionable. "Solve 2 medium Graph problems, revise BFS/DFS" not "practice graphs".
- Build on what the logs show they already know — don't tell them to start from scratch if their logs show prior work.
- Prioritize topics that are not_started or in_progress over ones already mastered, but consider topics they've already started (per logs) as in-progress even if the tracker says not_started.
- For suggested_resources, suggest topics or search-style queries. Do NOT fabricate specific YouTube video titles, channel names, or URLs unless they appear in the user's own logs. Use phrases like "search for 'graph BFS tutorial'" instead.
- Estimate readiness by comparing current pace (questions/week from logs + snapshots) against the target date and remaining topics.
- Return ONLY the JSON object, no markdown fences, no commentary.`;

interface RecommendationPayload {
  tomorrow: {
    leetcode_targets: { easy: number; medium: number; hard: number };
    topics_to_practice: string[];
    learning_tasks: string[];
  };
  this_week: {
    topics_to_finish: string[];
    question_targets: { easy: number; medium: number; hard: number };
    milestone: string;
  };
  this_month: {
    roadmap: string[];
    estimated_readiness: string;
  };
  weak_areas: string[];
  strengths: string[];
  suggested_resources: { topic: string; type: string; suggestion: string }[];
}

function extractJson(text: string): unknown {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in AI response");
  let jsonStr = t.slice(start, end + 1);
  // Common, safe-to-fix LLM JSON quirk: trailing comma before a closing } or ]
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(jsonStr);
}

const GEMINI_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.0-flash", "gemini-2.5-flash"];

function sanitizeModel(raw: string | undefined): string | null {
  if (!raw) return null;
  let m = raw.trim().replace(/^["'\s]+|["'\s]+$/g, "");
  m = m.replace(/^models\//i, "");
  return m || null;
}

async function callGemini(userMsg: string): Promise<RecommendationPayload> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const envModel = sanitizeModel(Deno.env.get("AI_MODEL"));
  const models = envModel ? [envModel, ...GEMINI_MODELS.filter((m) => m !== envModel)] : GEMINI_MODELS;

  let lastError = "";
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userMsg }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (res.ok) {
      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const content = parts.map((p: { text?: string }) => p.text ?? "").join("").trim();
      if (content) {
        try {
          return extractJson(content) as RecommendationPayload;
        } catch (parseErr) {
          lastError = `JSON parse failed for model ${model}: ${(parseErr as Error).message}. Raw content (first 500 chars): ${content.slice(0, 500)}`;
          continue;
        }
      }
      lastError = `Empty response from Gemini (finishReason: ${data.candidates?.[0]?.finishReason ?? "unknown"})`;
      continue;
    }

    const errText = await res.text();
    lastError = `Gemini API ${res.status} (${model}): ${errText}`;
    if (res.status !== 429 && res.status !== 404 && res.status !== 400 && res.status !== 503) break;
  }

  throw new Error(lastError || "All Gemini models exhausted");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError(401, "Missing Authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return jsonError(401, "Invalid session");
    const userId = userData.user.id;
    const dataClient = supabase;

    const since = new Date();
    since.setDate(since.getDate() - 60);
    const sinceStr = since.toISOString().slice(0, 10);

    const [{ data: logs }, { data: topics }, { data: settings }, { data: latestSnapshot }] = await Promise.all([
      dataClient.from("daily_logs").select("*").eq("user_id", userId).gte("log_date", sinceStr).order("log_date", { ascending: false }).limit(60),
      dataClient.from("topics").select("*").eq("user_id", userId).order("display_order", { ascending: true }),
      dataClient.from("settings").select("*").eq("user_id", userId).maybeSingle(),
      dataClient.from("leetcode_snapshots").select("*").eq("user_id", userId).order("snapshot_date", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const topicMap = (topics ?? []).map((t) => ({
      name: t.name,
      status: t.status,
      questions_solved: t.questions_solved,
      last_practiced_at: t.last_practiced_at,
    }));

    // Build raw log entries — the user's own free-text daily logs are the source of truth
    const rawLogEntries = (logs ?? [])
      .slice()
      .reverse()
      .map((l) => {
        const parts: string[] = [`[${l.log_date}]`];
        const raw = (l.raw_input ?? "").trim();
        if (raw) parts.push(raw);
        const notes = (l.notes ?? "").trim();
        if (notes) parts.push(`(notes: ${notes})`);
        if (l.easy_solved || l.medium_solved || l.hard_solved) {
          parts.push(`(solved: ${l.easy_solved}E / ${l.medium_solved}M / ${l.hard_solved}H)`);
        }
        if (l.difficulty_rating) parts.push(`(difficulty: ${l.difficulty_rating})`);
        if (l.time_minutes) parts.push(`(time: ${l.time_minutes}min)`);
        return parts.join(" ");
      })
      .filter((s) => s.length > 12);

    const userMsg = JSON.stringify({
      goal: settings?.goal_text ?? "placement-ready",
      target_date: settings?.target_date ?? null,
      topic_schedule: computeTopicSchedule(topicMap),
      user_daily_log_entries: rawLogEntries,
      log_summary: {
        total_logs: (logs ?? []).length,
        date_range: logs && logs.length > 0 ? `${logs[logs.length - 1].log_date} to ${logs[0].log_date}` : null,
      },
      structured_tracker: {
        topics: topicMap,
        leetcode_latest: latestSnapshot ?? null,
      },
    }, null, 2);

    let payload: RecommendationPayload;
    try {
      payload = await callGemini(userMsg);
    } catch (e) {
      return jsonError(502, `AI engine failed: ${e.message}`);
    }

    const { error: upsertErr } = await dataClient
      .from("recommendations")
      .upsert(
        { user_id: userId, payload: payload as unknown as Record<string, unknown>, generated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );

    if (upsertErr) {
      return jsonError(500, `Failed to save recommendation: ${upsertErr.message}`);
    }

    await dataClient.from("plan_items").delete().eq("user_id", userId).in("kind", ["tomorrow", "this_week", "this_month"]);

    const items: { user_id: string; kind: string; text: string }[] = [];
    for (const t of payload.tomorrow?.topics_to_practice ?? []) items.push({ user_id: userId, kind: "tomorrow", text: `Practice: ${t}` });
    for (const t of payload.tomorrow?.learning_tasks ?? []) items.push({ user_id: userId, kind: "tomorrow", text: t });
    for (const t of payload.this_week?.topics_to_finish ?? []) items.push({ user_id: userId, kind: "this_week", text: `Finish: ${t}` });
    if (payload.this_week?.milestone) items.push({ user_id: userId, kind: "this_week", text: `Milestone: ${payload.this_week.milestone}` });
    for (const t of payload.this_month?.roadmap ?? []) items.push({ user_id: userId, kind: "this_month", text: t });

    if (items.length > 0) {
      const { error: itemsErr } = await dataClient.from("plan_items").insert(items);
      if (itemsErr) {
        return jsonError(500, `Failed to save plan items: ${itemsErr.message}`);
      }
    }

    // Also write to plan_tasks (the adaptive roadmap source of truth).
    // Tomorrow's tasks are scheduled for tomorrow's date so they become "today" tasks the next day.
    // We ALSO seed today's tasks from the tomorrow payload so the user has immediate tasks on regenerate.
    // This week / this month tasks are scheduled for today (they're not date-specific).
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);

    // Clear prior tomorrow/this_week/this_month plan_tasks (keep 'today' tasks — those carry over)
    await dataClient.from("plan_tasks").delete().eq("user_id", userId).in("kind", ["tomorrow", "this_week", "this_month"]);

    const taskRows: { user_id: string; kind: string; text: string; scheduled_date: string }[] = [];
    // Seed today's tasks from the tomorrow payload (so the user has tasks to do today)
    for (const t of payload.tomorrow?.topics_to_practice ?? []) taskRows.push({ user_id: userId, kind: "today", text: `Practice: ${t}`, scheduled_date: todayStr });
    for (const t of payload.tomorrow?.learning_tasks ?? []) taskRows.push({ user_id: userId, kind: "today", text: t, scheduled_date: todayStr });
    // Tomorrow's tasks (same content, scheduled for tomorrow — these become today's tasks the day after)
    for (const t of payload.tomorrow?.topics_to_practice ?? []) taskRows.push({ user_id: userId, kind: "tomorrow", text: `Practice: ${t}`, scheduled_date: tomorrowStr });
    for (const t of payload.tomorrow?.learning_tasks ?? []) taskRows.push({ user_id: userId, kind: "tomorrow", text: t, scheduled_date: tomorrowStr });
    for (const t of payload.this_week?.topics_to_finish ?? []) taskRows.push({ user_id: userId, kind: "this_week", text: `Finish: ${t}`, scheduled_date: todayStr });
    if (payload.this_week?.milestone) taskRows.push({ user_id: userId, kind: "this_week", text: `Milestone: ${payload.this_week.milestone}`, scheduled_date: todayStr });
    for (const t of payload.this_month?.roadmap ?? []) taskRows.push({ user_id: userId, kind: "this_month", text: t, scheduled_date: todayStr });

    if (taskRows.length > 0) {
      const { error: taskInsertErr } = await dataClient.from("plan_tasks").insert(taskRows);
      if (taskInsertErr) {
        return jsonError(500, `Failed to save plan tasks: ${taskInsertErr.message}`);
      }
    }

    return new Response(JSON.stringify({ payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return jsonError(500, err.message || "Internal error");
  }
});

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
