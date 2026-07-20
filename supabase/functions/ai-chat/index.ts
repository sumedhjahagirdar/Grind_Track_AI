import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
- Do NOT fabricate specific video titles, channel names, or URLs. Suggest search queries instead.`;

interface ChatMessage {
  role: string;
  content: string;
}

function extractText(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json|text)?\s*/i, "").replace(/```\s*$/, "");
  }
  return t;
}

const GEMINI_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.0-flash", "gemini-2.5-flash"];

function sanitizeModel(raw: string | undefined): string | null {
  if (!raw) return null;
  let m = raw.trim().replace(/^["'\s]+|["'\s]+$/g, "");
  m = m.replace(/^models\//i, "");
  return m || null;
}

async function callGemini(history: ChatMessage[], contextMsg: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const envModel = sanitizeModel(Deno.env.get("AI_MODEL"));
  const models = envModel ? [envModel, ...GEMINI_MODELS.filter((m) => m !== envModel)] : GEMINI_MODELS;

  // Gemini requires alternating roles (user/model). Build contents from history.
  // The last message in history is the user's new message — append context to it.
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    const role = m.role === "assistant" ? "model" : "user";
    // If this is the last message (user's new message), append the context data
    if (i === history.length - 1 && m.role === "user") {
      contents.push({
        role: "user",
        parts: [{ text: `${m.content}\n\n---\n[Your context data — the user's own daily log entries below are the PRIMARY source of truth about their progress. Reason from the logs first, not the structured tracker.]\n${contextMsg}` }],
      });
    } else {
      contents.push({
        role,
        parts: [{ text: m.content }],
      });
    }
  }

  let lastError = "";
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 1024,
          },
        }),
      },
    );

    if (res.ok) {
      const data = await res.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (content) return extractText(content);
      lastError = "Empty response from Gemini";
      continue;
    }

    const errText = await res.text();
    lastError = `Gemini API ${res.status} (${model}): ${errText}`;
    // 429 = quota, 404 = model not found, 400 = bad model name — try next model
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

    const body = await req.json();
    const { message } = body as { message: string; history?: ChatMessage[] };

    if (!message || !message.trim()) return jsonError(400, "Missing 'message' field");

    const since = new Date();
    since.setDate(since.getDate() - 60);
    const sinceStr = since.toISOString().slice(0, 10);

    const [{ data: logs }, { data: topics }, { data: settings }, { data: latestLc }, { data: latestCf }, { data: recentChat }] = await Promise.all([
      dataClient.from("daily_logs").select("*").eq("user_id", userId).gte("log_date", sinceStr).order("log_date", { ascending: false }).limit(60),
      dataClient.from("topics").select("*").eq("user_id", userId).order("display_order", { ascending: true }),
      dataClient.from("settings").select("*").eq("user_id", userId).maybeSingle(),
      dataClient.from("leetcode_snapshots").select("*").eq("user_id", userId).order("snapshot_date", { ascending: false }).limit(1).maybeSingle(),
      dataClient.from("codeforces_snapshots").select("*").eq("user_id", userId).order("snapshot_date", { ascending: false }).limit(1).maybeSingle(),
      dataClient.from("chat_messages").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    ]);

    // Build raw log entries — the user's own free-text daily logs are the source of truth
    const rawLogEntries = (logs ?? [])
      .slice()
      .reverse() // chronological order (oldest first) for readability
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
      .filter((s) => s.length > 12); // skip entries with only a date

    const contextData = {
      goal: settings?.goal_text ?? "placement-ready",
      target_date: settings?.target_date ?? null,
      leetcode_username: settings?.leetcode_username ?? null,
      codeforces_handle: settings?.codeforces_handle ?? null,
      user_daily_log_entries: rawLogEntries,
      log_summary: {
        total_logs: (logs ?? []).length,
        date_range: logs && logs.length > 0 ? `${logs[logs.length - 1].log_date} to ${logs[0].log_date}` : null,
      },
      structured_tracker: {
        topics: (topics ?? []).map((t) => ({
          name: t.name,
          status: t.status,
          questions_solved: t.questions_solved,
        })),
        leetcode_latest: latestLc ?? null,
        codeforces_latest: latestCf ?? null,
      },
    };

    const contextMsg = JSON.stringify(contextData, null, 2);

    // Build conversation history from stored chat messages (oldest first)
    const chatHistory: ChatMessage[] = (recentChat ?? []).reverse().map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Append the user's new message
    const fullHistory = [...chatHistory, { role: "user", content: message }];

    let response: string;
    try {
      response = await callGemini(fullHistory, contextMsg);
    } catch (e) {
      return jsonError(502, `AI engine failed: ${e.message}`);
    }

    // Save the conversation to the database
    await dataClient.from("chat_messages").insert([
      { user_id: userId, role: "user", content: message },
      { user_id: userId, role: "assistant", content: response },
    ]);

    return new Response(JSON.stringify({ response }), {
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
