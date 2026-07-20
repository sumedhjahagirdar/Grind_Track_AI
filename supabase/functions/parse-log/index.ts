import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `You are a parsing engine for a DSA/LeetCode/Codeforces progress tracker.
Given a user's free-text daily activity log, extract structured data into EXACTLY this JSON shape:

{
  "date": "YYYY-MM-DD" (use the provided date; if the user mentions a different date in text, use that),
  "leetcode": {
    "easy_solved": number,
    "medium_solved": number,
    "hard_solved": number,
    "topics": string[] (DSA topics touched, normalized to canonical names where possible: "Arrays & Strings","Recursion & Backtracking","Linked Lists","Stacks & Queues","Trees","Heaps / Priority Queues","Graphs","Dynamic Programming","Greedy Algorithms","Sliding Window / Two Pointers","Binary Search","Tries","Bit Manipulation","Sorting Algorithms","Math / Number Theory"),
    "difficulty_feedback": [{"topic": string, "note": string}] (topics the user found hard/easy, with their note)
  },
  "codeforces": {
    "solved": number (problems solved on Codeforces, if mentioned),
    "contest_rating_change": number (rating change if they participated in a contest, 0 if not),
    "topics": string[] (topics practiced on Codeforces, same canonical list)
  },
  "learning": [{"resource_type": "youtube"|"course"|"book"|"article"|"other", "source": string, "topic": string, "units": string}],
  "other_notes": string (catch-all for anything not captured above),
  "raw_input": string (the original user text, verbatim, untouched)
}

Rules:
- If a number is not mentioned, use 0.
- If a field is not mentioned, use an empty array or empty string as appropriate.
- Do NOT invent topics not implied by the text.
- Preserve the user's raw_input exactly as given.
- Return ONLY the JSON object, no markdown fences, no commentary.`;

interface ParseResult {
  date: string;
  leetcode: {
    easy_solved: number;
    medium_solved: number;
    hard_solved: number;
    topics: string[];
    difficulty_feedback: { topic: string; note: string }[];
  };
  codeforces: {
    solved: number;
    contest_rating_change: number;
    topics: string[];
  };
  learning: { resource_type: string; source: string; topic: string; units: string }[];
  other_notes: string;
  raw_input: string;
}

function extractJson(text: string): unknown {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in AI response");
  return JSON.parse(t.slice(start, end + 1));
}

const GEMINI_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.0-flash", "gemini-2.5-flash"];

function sanitizeModel(raw: string | undefined): string | null {
  if (!raw) return null;
  let m = raw.trim().replace(/^["'\s]+|["'\s]+$/g, "");
  m = m.replace(/^models\//i, "");
  return m || null;
}

async function callGemini(text: string, date: string): Promise<ParseResult> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const envModel = sanitizeModel(Deno.env.get("AI_MODEL"));
  const models = envModel ? [envModel, ...GEMINI_MODELS.filter((m) => m !== envModel)] : GEMINI_MODELS;

  const userMsg = `Date: ${date}\nUser log:\n${text}`;

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
            temperature: 0.1,
            maxOutputTokens: 1024,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (res.ok) {
      const data = await res.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (content) {
        try {
          return extractJson(content) as ParseResult;
        } catch (parseErr) {
          lastError = `JSON parse failed for model ${model}: ${(parseErr as Error).message}. Raw content (first 500 chars): ${content.slice(0, 500)}`;
          continue;
        }
      }
      lastError = `Empty response from Gemini model ${model}. finishReason: ${data.candidates?.[0]?.finishReason ?? "unknown"}`;
      continue;
    }

    const errText = await res.text();
    lastError = `Gemini API ${res.status} (${model}): ${errText}`;
    if (res.status !== 429 && res.status !== 404 && res.status !== 400) break;
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
    const { text, date } = body as { text: string; date?: string };
    if (!text || !text.trim()) return jsonError(400, "Missing 'text' field");
    const logDate = date || new Date().toISOString().slice(0, 10);

    let parsed: ParseResult;
    let parseError: string | null = null;
    try {
      parsed = await callGemini(text, logDate);
    } catch (e) {
      parseError = e.message;
      parsed = {
        date: logDate,
        leetcode: { easy_solved: 0, medium_solved: 0, hard_solved: 0, topics: [], difficulty_feedback: [] },
        codeforces: { solved: 0, contest_rating_change: 0, topics: [] },
        learning: [],
        other_notes: text,
        raw_input: text,
      };
    }

    parsed.raw_input = text;

    const topics = parsed.leetcode?.topics ?? [];
    const easy = parsed.leetcode?.easy_solved ?? 0;
    const medium = parsed.leetcode?.medium_solved ?? 0;
    const hard = parsed.leetcode?.hard_solved ?? 0;

    // Always insert a new row — multiple logs per day are allowed
    const insertData = {
      user_id: userId,
      log_date: logDate,
      raw_input: text,
      parsed: parsed as unknown as Record<string, unknown>,
      easy_solved: easy,
      medium_solved: medium,
      hard_solved: hard,
      topics,
    };

    const { data: dbRow, error: insertErr } = await dataClient
      .from("daily_logs")
      .insert(insertData)
      .select()
      .single();

    if (insertErr) return jsonError(500, `Insert failed: ${insertErr.message}`);

    // Update topic progress
    for (const topicName of topics) {
      const { data: topicRow } = await dataClient
        .from("topics")
        .select("id, questions_solved, status")
        .eq("user_id", userId)
        .eq("name", topicName)
        .maybeSingle();

      if (topicRow) {
        const newCount = (topicRow.questions_solved || 0) + (easy + medium + hard);
        const newStatus = newCount >= 15 ? "mastered" : newCount >= 5 ? "practiced" : "in_progress";
        await dataClient
          .from("topics")
          .update({
            questions_solved: newCount,
            last_practiced_at: logDate,
            status: newStatus === "mastered" && topicRow.status === "mastered" ? "mastered" : newStatus,
          })
          .eq("id", topicRow.id);
      }
    }

    return new Response(JSON.stringify({ parsed, log: dbRow, parse_error: parseError }), {
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
