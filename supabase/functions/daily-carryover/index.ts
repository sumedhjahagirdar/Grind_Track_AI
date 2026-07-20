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
    if (tasks.length === 0) {
      return new Response(JSON.stringify({
        carried_over_count: 0,
        missed_days: 0,
        message: null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Determine the span of missed days (min original or scheduled date -> today)
    const dates = tasks.map((t) => t.original_date ?? t.scheduled_date).sort();
    const earliest = dates[0];
    const missedDays = Math.max(1, Math.round(
      (new Date(today).getTime() - new Date(earliest).getTime()) / (1000 * 60 * 60 * 24),
    ));

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

    const message = updated > 0
      ? `Plan adjusted — ${updated} task${updated === 1 ? "" : "s"} from ${missedDays} missed day${missedDays === 1 ? "" : "s"} carried forward to today.`
      : null;

    return new Response(JSON.stringify({
      carried_over_count: updated,
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
