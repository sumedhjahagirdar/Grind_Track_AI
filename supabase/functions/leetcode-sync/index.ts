import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

interface LeetcodeProfile {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  acceptanceRate: number | null;
  contestRating: number | null;
  contestCount: number | null;
  globalRanking: number | null;
  raw: Record<string, unknown>;
}

interface CalendarEntry {
  date: string; // YYYY-MM-DD
  count: number;
}

async function fetchLeetcodeStats(username: string): Promise<LeetcodeProfile> {
  const query = `query userProblemsSolvedAndContest($username: String!) {
    userContestRanking(username: $username) {
      attendedContestsCount
      rating
      globalRanking
    }
    matchedUser(username: $username) {
      submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
        }
        totalSubmissionNum {
          difficulty
          submissions
          count
        }
      }
      profile {
        ranking
      }
    }
  }`;

  const res = await fetch(LEETCODE_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "GrindTrackAI/1.0",
    },
    body: JSON.stringify({ query, variables: { username } }),
  });

  if (!res.ok) throw new Error(`LeetCode API returned ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(`LeetCode GraphQL error: ${JSON.stringify(json.errors)}`);

  const mu = json.data?.matchedUser;
  if (!mu) throw new Error("LeetCode profile not found or private");

  const acSubs = mu.submitStatsGlobal?.acSubmissionNum ?? [];
  const totalSubs = mu.submitStatsGlobal?.totalSubmissionNum ?? [];
  const ranking = mu.profile?.ranking ?? null;

  const byDiff = (arr: { difficulty: string; count: number; submissions?: number }[], diff: string) =>
    arr.find((x) => x.difficulty === diff)?.count ?? 0;

  const easy = byDiff(acSubs, "Easy");
  const medium = byDiff(acSubs, "Medium");
  const hard = byDiff(acSubs, "Hard");
  const total = easy + medium + hard;

  const totalSubmitted = totalSubs.reduce((s: number, x: { submissions: number }) => s + (x.submissions ?? 0), 0);
  const totalAccepted = acSubs.reduce((s: number, x: { count: number }) => s + (x.count ?? 0), 0);
  const acceptanceRate = totalSubmitted > 0 ? Math.round((totalAccepted / totalSubmitted) * 1000) / 10 : null;

  const contest = json.data?.userContestRanking;
  const contestRating = contest?.rating ?? null;
  const contestCount = contest?.attendedContestsCount ?? null;
  const globalRanking = contest?.globalRanking ?? ranking ?? null;

  return {
    totalSolved: total,
    easySolved: easy,
    mediumSolved: medium,
    hardSolved: hard,
    acceptanceRate,
    contestRating,
    contestCount,
    globalRanking,
    raw: json.data as Record<string, unknown>,
  };
}

async function fetchLeetcodeCalendar(username: string): Promise<CalendarEntry[]> {
  // userProfileCalendar returns the submission calendar for the last ~year.
  // The "submissionCalendar" field is a JSON string mapping unix timestamps (seconds) -> count.
  const query = `query userProfileCalendar($username: String!) {
    matchedUser(username: $username) {
      userCalendar {
        submissionCalendar
      }
    }
  }`;

  const res = await fetch(LEETCODE_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "GrindTrackAI/1.0",
    },
    body: JSON.stringify({ query, variables: { username } }),
  });

  if (!res.ok) throw new Error(`LeetCode calendar API returned ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(`LeetCode calendar GraphQL error: ${JSON.stringify(json.errors)}`);

  const calStr = json.data?.matchedUser?.userCalendar?.submissionCalendar;
  if (!calStr) return [];

  let cal: Record<string, number>;
  try {
    cal = JSON.parse(calStr);
  } catch {
    return [];
  }

  const entries: CalendarEntry[] = [];
  for (const [tsStr, count] of Object.entries(cal)) {
    const ts = parseInt(tsStr, 10) * 1000;
    const d = new Date(ts);
    const dateStr = d.toISOString().slice(0, 10);
    entries.push({ date: dateStr, count: count as number });
  }
  return entries;
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

    const { data: settings } = await dataClient
      .from("settings")
      .select("leetcode_username")
      .eq("user_id", userId)
      .maybeSingle();

    const username = settings?.leetcode_username;
    if (!username) return jsonError(400, "No LeetCode username configured. Set it in Settings.");

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    let profile: LeetcodeProfile | null = null;
    let profileError: string | null = null;
    try {
      profile = await fetchLeetcodeStats(username);
    } catch (e) {
      profileError = e.message;
    }

    let calendarEntries: CalendarEntry[] = [];
    let calendarError: string | null = null;
    try {
      calendarEntries = await fetchLeetcodeCalendar(username);
    } catch (e) {
      calendarError = e.message;
    }

    // If both failed, log a failure and return the last-known state.
    if (profileError && calendarError) {
      await dataClient.from("leetcode_sync_log").insert({
        user_id: userId,
        status: "failed",
        error_message: `stats: ${profileError}; calendar: ${calendarError}`,
        submissions_synced: 0,
        snapshot_synced: false,
      });
      return jsonError(502, `LeetCode sync failed: stats=${profileError}; calendar=${calendarError}`);
    }

    // Upsert submission calendar entries
    let submissionsSynced = 0;
    if (calendarEntries.length > 0) {
      const rows = calendarEntries.map((e) => ({
        user_id: userId,
        date: e.date,
        submission_count: e.count,
        fetched_at: now.toISOString(),
      }));
      const { error: upsertErr } = await dataClient
        .from("leetcode_submission_calendar")
        .upsert(rows, { onConflict: "user_id,date" });
      if (!upsertErr) submissionsSynced = calendarEntries.length;
    }

    // Upsert daily snapshot
    let snapshotSynced = false;
    let snapshotRow = null;
    if (profile) {
      const { data: existing } = await dataClient
        .from("leetcode_snapshots")
        .select("id")
        .eq("user_id", userId)
        .eq("snapshot_date", today)
        .maybeSingle();

      const rowData = {
        user_id: userId,
        snapshot_date: today,
        total_solved: profile.totalSolved,
        easy_solved: profile.easySolved,
        medium_solved: profile.mediumSolved,
        hard_solved: profile.hardSolved,
        acceptance_rate: profile.acceptanceRate,
        contest_rating: profile.contestRating,
        contest_count: profile.contestCount,
        global_ranking: profile.globalRanking,
        raw: profile.raw,
      };

      if (existing?.id) {
        const { data, error } = await dataClient.from("leetcode_snapshots").update(rowData).eq("id", existing.id).select().single();
        if (!error) { snapshotRow = data; snapshotSynced = true; }
      } else {
        const { data, error } = await dataClient.from("leetcode_snapshots").insert(rowData).select().single();
        if (!error) { snapshotRow = data; snapshotSynced = true; }
      }
    }

    await dataClient.from("leetcode_sync_log").insert({
      user_id: userId,
      status: "success",
      error_message: (profileError || calendarError) ? `partial: stats=${profileError ?? "ok"} calendar=${calendarError ?? "ok"}` : null,
      submissions_synced: submissionsSynced,
      snapshot_synced: snapshotSynced,
    });

    return new Response(JSON.stringify({
      snapshot: snapshotRow,
      profile,
      submissions_synced: submissionsSynced,
      snapshot_synced: snapshotSynced,
    }), {
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
