import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { RawCandidate } from "./scoring.server";

/** Approval is recorded only after the funder exists; failed approvals stay retryable. */
export async function promoteCandidate(db: SupabaseClient<Database>, candidateId: string, candidate: RawCandidate) {
  const { error } = await db.from("funders").upsert({
    name: candidate.name, name_fr: candidate.name_fr ?? null, country: "CA",
    jurisdiction: candidate.province ?? null, website: candidate.website ?? null,
    source_url: candidate.website ?? null, source_type: "manual",
    bn_number: candidate.bn_number ?? null, disbursed_annual: candidate.disbursed_annual ?? null, active: true,
  }, { onConflict: "name,country", ignoreDuplicates: true });
  if (error) throw new Error(`funder_promotion_failed:${error.message}`);
  const { error: approvalError } = await db.from("funder_candidates").update({ status: "approved" }).eq("id", candidateId);
  if (approvalError) throw new Error(`candidate_approval_failed:${approvalError.message}`);
}
/** Repair a previous successful funder write whose candidate approval failed. */
export async function reconcileCandidateApproval(db: SupabaseClient<Database>, candidate: RawCandidate) {
  let query = db.from("funder_candidates").update({ status: "approved" }).eq("status", "pending_review");
  query = candidate.bn_number ? query.eq("bn_number", candidate.bn_number) : query.eq("name", candidate.name);
  const { error } = await query;
  if (error) throw new Error(`candidate_approval_failed:${error.message}`);
}
