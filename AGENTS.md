<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# GrantDesk — project rules

- Keep server functions in `src/lib/*.functions.ts`; dynamically import server-only `src/server/` modules inside handlers to protect the client bundle.
- Text AI priority is Lovable AI Gateway first, then Gemini → Groq → Cerebras as fallback; embeddings use Lovable `google/gemini-embedding-2` at 768 dimensions. User requested Lovable Cloud AI as the primary resource.
- Never impose client deadlines on AI calls because aborted generation still completes and bills.
- Keep eligibility deterministic in `src/lib/eligibility.ts`; models never decide verdicts and `unknown` is valid.
- Run catalog ingest and embedding through signed-in `refreshCatalog`; there is no cron.
- Make schema changes additive; deprecate rather than drop columns.
- Keep the intentionally loose synced-code TypeScript settings and exclude tests/e2e/fixtures from typecheck.
- Search `grant_embeddings` through `match_grant_search_documents`; if vector results return fewer than 20 rows (or vectors are pending), always run tokenized keyword fallback across `grants` (title, summary, eligibility_note) and `funders.name` so search queries never falsely return empty.
- Provision new users through idempotent `ensure_current_user()` in the authenticated layout because auth-schema triggers are unavailable.
- Surface failed soft eligibility checks without changing their verdict effect.
- Evaluation precedence: A grant's persisted `grant_evaluations` record is authoritative. In `toRadarItem`, `g.evaluation` takes precedence over preliminary heuristics, ensuring that an evaluation verdict (`eligible` vs `not_eligible`) updates immediately in the UI with its detailed rationale, normalized fit percentage, and next action.
- In `listGrants`, `includeHardBlocked` defaults to `true` and projects `evaluation` status/fit onto returned grants so Radar and Dashboard maintain coherent global counts.
- Evaluator calls must never abort the batch pipeline: if cloud LLMs are rate-limited (429) or unavailable, evaluateGrant falls back to the deterministic rules engine (`rules-engine-deterministic`) ensuring continuous 100% completion.
- Coerce and normalize `fit_score` to `[0, 1]` in evaluator schemas to absorb models returning 0-100 scales.
- Run live cloud/AI tests only with `LIVE_CLOUD=1` to avoid accidental spend.
- Keep Grant Radar ranking, filtering, country grouping, and deterministic prefiltering in `src/lib/grant-radar.ts`; default `minAmount` to 0 so unstated grant amounts are visible, and prioritize search text over secondary eligibility filters when actively searching.
- Theme through `src/styles.css` semantic tokens, following iial.ca's light institutional style.
- Read Grants.gov detail data from its official structured endpoint before scraping; unpublished fields stay unknown and reduce coverage without failing enrichment.
- V2 is the only user-facing interface; keep the version context fixed to V2 while legacy branches remain temporarily for reference. This prevents split UX while allowing safe, incremental cleanup.
