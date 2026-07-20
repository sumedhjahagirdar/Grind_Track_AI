import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CodeforcesProfile {
  handle: string;
  rating: number;
  maxRating: number;
  rank: string;
  maxRank: string;
  solvedCount: number;
  contestCount: number;
  friendCount: number;
  contribution: number;
  raw: Record<string, unknown>;
}

async function fetchCodeforcesInfo(handle: string): Promise<Partial<CodeforcesProfile>> {
  const infoUrl = `https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`;
  const res = await fetch(infoUrl, { headers: { "User-Agent": "GrindTrackAI/1.0" } });
  if (!res.ok) throw new Error(`Codeforces API returned ${res.status}`);
  const json = await res.json();
  if (json.status !== "OK") throw new Error(json.comment || "Codeforces API error");
  return json.result?.[0] ?? {};
}

async function fetchCodeforcesRating(handle: string): Promise<{ contests: unknown[]; raw: Record<string, unknown> }> {
  const url = `https://codeforces.com/api/user.rating?handle=${encodeURIComponent(handle)}`;
  const res = await fetch(url, { headers: { "User-Agent": "GrindTrackAI/1.0" } });
  if (!res.ok) throw new Error(`Codeforces rating API returned ${res.status}`);
  const json = await res.json();
  if (json.status !== "OK") throw new Error(json.comment || "Codeforces rating API error");
  return { contests: json.result ?? [], raw: json };
}

async function fetchCodeforcesSubmissions(handle: string): Promise<{ solved: number; raw: Record<string, unknown> }> {
  const url = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&count=10000`;
  const res = await fetch(url, { headers: { "User-Agent": "GrindTrackAI/1.0" } });
  if (!res.ok) throw new Error(`Codeforces status API returned ${res.status}`);
  const json = await res.json();
  if (json.status !== "OK") throw new Error(json.comment || "Codeforces status API error");
  const submissions = json.result ?? [];
  const solvedSet = new Set<string>();
  for (const s of submissions) {
    if (s.verdict === "OK" && s.problem) {
      const key = `${s.problem.contestId}-${s.problem.index}`;
      solvedSet.add(key);
    }
  }
  return { solved: solvedSet.size, raw: { totalSubmissions: submissions.length } };
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

    const { data: settings } = await supabase
      .from("settings")
      .select("codeforces_handle")
      .eq("user_id", userId)
      .maybeSingle();

    const handle = settings?.codeforces_handle;
    if (!handle) return jsonError(400, "No Codeforces handle configured. Set it in Settings.");

    let info, ratingData, subData;
    try {
      [info, ratingData, subData] = await Promise.all([
        fetchCodeforcesInfo(handle),
        fetchCodeforcesRating(handle),
        fetchCodeforcesSubmissions(handle),
      ]);
    } catch (e) {
      return jsonError(502, `Codeforces sync failed: ${e.message}`);
    }

    const contests = ratingData.contests as Array<Record<string, unknown>>;
    const latestContest = contests.length > 0 ? contests[contests.length - 1] : null;

    const profile: CodeforcesProfile = {
      handle: handle,
      rating: (info.rating as number) ?? (latestContest?.newRating as number) ?? 0,
      maxRating: (info.maxRating as number) ?? 0,
      rank: (info.rank as string) ?? "",
      maxRank: (info.maxRank as string) ?? "",
      solvedCount: subData.solved,
      contestCount: contests.length,
      friendCount: (info.friendOf as number) ?? 0,
      contribution: (info.contribution as number) ?? 0,
      raw: { info, rating: ratingData.raw, submissions: subData.raw },
    };

    const today = new Date().toISOString().slice(0, 10);

    const { data: existing } = await supabase
      .from("codeforces_snapshots")
      .select("id")
      .eq("user_id", userId)
      .eq("snapshot_date", today)
      .maybeSingle();

    const rowData = {
      user_id: userId,
      snapshot_date: today,
      handle: profile.handle,
      rating: profile.rating,
      max_rating: profile.maxRating,
      rank: profile.rank,
      max_rank: profile.maxRank,
      solved_count: profile.solvedCount,
      contest_count: profile.contestCount,
      friend_count: profile.friendCount,
      contribution: profile.contribution,
      raw: profile.raw,
    };

    let snapshotRow;
    if (existing?.id) {
      const { data, error } = await supabase.from("codeforces_snapshots").update(rowData).eq("id", existing.id).select().single();
      if (error) return jsonError(500, `Update failed: ${error.message}`);
      snapshotRow = data;
    } else {
      const { data, error } = await supabase.from("codeforces_snapshots").insert(rowData).select().single();
      if (error) return jsonError(500, `Insert failed: ${error.message}`);
      snapshotRow = data;
    }

    return new Response(JSON.stringify({ snapshot: snapshotRow, profile }), {
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
