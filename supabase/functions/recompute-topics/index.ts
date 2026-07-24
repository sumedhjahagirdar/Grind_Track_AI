import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

    // Pull every log this user has ever written.
    const { data: logs, error: logsErr } = await supabase
      .from("daily_logs")
      .select("easy_solved, medium_solved, hard_solved, topics, parsed")
      .eq("user_id", userId);

    if (logsErr) return jsonError(500, `Failed to fetch logs: ${logsErr.message}`);

    // Rebuild each topic's true count from scratch. Older logs were saved
    // before per-topic breakdowns existed, so for those we split the log's
    // total evenly across the topics it mentioned (fair approximation) —
    // newer logs use the real topic_breakdown if it's present in the stored
    // parsed JSON. Either way, this replaces the old buggy behavior of
    // adding the FULL total to every mentioned topic.
    const totals: Record<string, number> = {};

    for (const log of logs ?? []) {
      const parsedBreakdown = (log.parsed as any)?.leetcode?.topic_breakdown as
        | { topic: string; easy: number; medium: number; hard: number }[]
        | undefined;

      if (parsedBreakdown && parsedBreakdown.length > 0) {
        for (const entry of parsedBreakdown) {
          const n = (entry.easy || 0) + (entry.medium || 0) + (entry.hard || 0);
          if (n > 0) totals[entry.topic] = (totals[entry.topic] || 0) + n;
        }
        continue;
      }

      const topics: string[] = log.topics || [];
      const total = (log.easy_solved || 0) + (log.medium_solved || 0) + (log.hard_solved || 0);
      if (topics.length === 0 || total === 0) continue;

      const share = total / topics.length;
      for (const t of topics) {
        totals[t] = (totals[t] || 0) + share;
      }
    }

    // Write the corrected totals back, and reset any topic not mentioned
    // in any log to 0 (in case old buggy runs inflated it with nothing to
    // back it up now).
    const { data: allTopics, error: topicsErr } = await supabase
      .from("topics")
      .select("id, name, status")
      .eq("user_id", userId);

    if (topicsErr) return jsonError(500, `Failed to fetch topics: ${topicsErr.message}`);

    let updated = 0;
    for (const topic of allTopics ?? []) {
      const newCount = Math.round(totals[topic.name] || 0);
      const newStatus = newCount >= 15 ? "mastered" : newCount >= 5 ? "practiced" : newCount > 0 ? "in_progress" : "not_started";
      const { error: updErr } = await supabase
        .from("topics")
        .update({ questions_solved: newCount, status: newStatus })
        .eq("id", topic.id);
      if (!updErr) updated++;
    }

    return new Response(JSON.stringify({ topics_updated: updated, totals }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return jsonError(500, e instanceof Error ? e.message : "Unknown error");
  }
});
