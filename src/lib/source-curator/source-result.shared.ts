import type { RawCandidate } from "./scoring.server";

export type SourceResult = { candidates: RawCandidate[]; errors: string[] };
export function sourceOutcome(result: RawCandidate[] | SourceResult) {
  const candidates = Array.isArray(result) ? result : result.candidates;
  const errors = Array.isArray(result) ? [] : result.errors;
  return { candidates, errors, status: errors.length ? (candidates.length ? "degraded" as const : "failed" as const) : "succeeded" as const };
}