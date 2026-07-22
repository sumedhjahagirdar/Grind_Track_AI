import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const today = new Date().toISOString().slice(0, 10);

    // Find all 'today' tasks scheduled BEFORE today that are not completed.
    // These are tasks from prior days that were never finished — they must roll forward.
    const { data: staleTasks, error: fetchErr } = await dataClient
      .from("plan_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("kind", "today")
      .lt("scheduled_date", today)
      .neq("status", "completed");

    if (fetchErr) return jsonError(500, `Failed to fetch stale tasks: ${fetchErr.message}`);

    const tasks = staleTasks ?? [];

    // Determine the span of missed days (min original or scheduled date -> today)
    let missedDays = 0;
    if (tasks.length > 0) {
      const dates = tasks.map((t) => t.original_date ?? t.scheduled_date).sort();
      const earliest = dates[0];
      missedDays = Math.max(1, Math.round(
        (new Date(today).getTime() - new Date(earliest).getTime()) / (1000 * 60 * 60 * 24),
      ));
    }

    // Roll each stale task forward to today, preserving the original_date.
    const updates = tasks.map((t) => {
      const originalDate = t.original_date ?? t.scheduled_date;
      return {
        id: t.id,
        scheduled_date: today,
        original_date: originalDate,
        carried_over: true,
      };
    });

    let updated = 0;
    for (const u of updates) {
      const { error } = await dataClient
        .from("plan_tasks")
        .update({
          scheduled_date: u.scheduled_date,
          original_date: u.original_date,
          carried_over: u.carried_over,
        })
        .eq("id", u.id);
      if (!error) updated++;
    }

    // --- Cap "Today" at MAX_TODAY_TASKS ---
    // After carrying stale tasks forward, "Today" can balloon (e.g. 3 missed days
    // of tasks all landing on today). Keep it manageable: prioritize the most
    // overdue tasks (they've been waiting longest), keep only the cap, and
    // reallocate the overflow to Tomorrow instead of dumping it all on today.
    const MAX_TODAY_TASKS = 6;
    let reallocated = 0;

    const { data: todayNow, error: todayErr } = await dataClient
      .from("plan_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("kind", "today")
      .lte("scheduled_date", today)
      .neq("status", "completed");

    if (!todayErr && todayNow && todayNow.length > MAX_TODAY_TASKS) {
      // Oldest original_date (or scheduled_date if never carried) = most overdue = highest priority to keep today.
      const sorted = [...todayNow].sort((a, b) => {
        const da = a.original_date ?? a.scheduled_date;
        const db = b.original_date ?? b.scheduled_date;
        return da < db ? -1 : da > db ? 1 : 0;
      });
      const overflow = sorted.slice(MAX_TODAY_TASKS);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      for (const t of overflow) {
        const { error } = await dataClient
          .from("plan_tasks")
          .update({ kind: "tomorrow", scheduled_date: tomorrow })
          .eq("id", t.id);
        if (!error) reallocated++;
      }
    }

    const parts: string[] = [];
    if (updated > 0) {
      parts.push(`${updated} task${updated === 1 ? "" : "s"} from ${missedDays} missed day${missedDays === 1 ? "" : "s"} carried forward to today`);
    }
    if (reallocated > 0) {
      parts.push(`${reallocated} task${reallocated === 1 ? "" : "s"} moved to tomorrow to keep today manageable (max ${MAX_TODAY_TASKS}/day)`);
    }
    const message = parts.length > 0 ? `Plan adjusted — ${parts.join("; ")}.` : null;

    return new Response(JSON.stringify({
      carried_over_count: updated,
      reallocated_count: reallocated,
      missed_days: missedDays,
      message,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
