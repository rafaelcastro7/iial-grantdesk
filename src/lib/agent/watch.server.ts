import { newForWatch } from "./agent-rules.shared";

const DAY = 86_400_000;

export async function runAgentWatches() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: watches, error } = await supabaseAdmin
    .from("agent_watches")
    .select("id, user_id, query, frequency, last_run_at, seen_grant_ids")
    .eq("paused", false);
  if (error) return { ok: false, error: error.message };

  const now = Date.now();
  let created = 0;
  const failures: string[] = [];
  for (const w of watches ?? []) {
    const due = !w.last_run_at || now - new Date(w.last_run_at).getTime() >= (w.frequency === "weekly" ? 7 : 1) * DAY - 3_600_000;
    if (!due) continue;
    const { data: hits, error: sErr } = await supabaseAdmin.rpc("search_grant_catalog", {
      search_query: w.query,
      result_limit: 30,
    });
    if (sErr) {
      failures.push(`${w.id}: ${sErr.message}`);
      continue;
    }
    const ids = (hits ?? []).filter((h) => h.relevance > 0.15).map((h) => h.grant_id);
    const fresh = newForWatch(ids, w.seen_grant_ids ?? []);
    const { data: grants } = ids.length
      ? await supabaseAdmin.from("grants").select("id, title, deadline, status").in("id", ids)
      : { data: [] };
    const rows: Array<{ user_id: string; watch_id: string; kind: string; title: string; body: string; grant_id: string }> = [];
    for (const g of grants ?? []) {
      if (["archived", "expired", "lost"].includes(g.status)) continue;
      if (fresh.includes(g.id)) {
        rows.push({ user_id: w.user_id, watch_id: w.id, kind: "new_grant", title: g.title, body: w.query, grant_id: g.id });
      } else if (g.deadline) {
        const days = (new Date(g.deadline).getTime() - now) / DAY;
        if (days > 0 && days <= 14 && days > 13 - (w.frequency === "weekly" ? 7 : 1)) {
          rows.push({ user_id: w.user_id, watch_id: w.id, kind: "deadline_soon", title: g.title, body: g.deadline, grant_id: g.id });
        }
      }
    }
    if (rows.length) {
      const { error: iErr } = await supabaseAdmin.from("agent_inbox").insert(rows);
      if (iErr) {
        failures.push(`${w.id}: ${iErr.message}`);
        continue;
      }
      created += rows.length;
    }
    await supabaseAdmin
      .from("agent_watches")
      .update({ last_run_at: new Date().toISOString(), seen_grant_ids: [...new Set([...(w.seen_grant_ids ?? []), ...ids])].slice(-500) })
      .eq("id", w.id);
  }
  return { ok: failures.length === 0, watches: watches?.length ?? 0, created, failures };
}
