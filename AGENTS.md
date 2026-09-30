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

- Server functions live in `src/lib/*.functions.ts`; import `src/server/` modules dynamically inside handlers (client bundle safety).
- Text AI: Lovable AI Gateway first, then Gemini → Groq → Cerebras fallback; embeddings Lovable `google/gemini-embedding-2` @768. User chose Lovable as primary.
- No client deadlines on AI calls (aborted generations still bill); live AI tests only with `LIVE_CLOUD=1`.
- Eligibility is deterministic in `src/lib/eligibility.ts`; `unknown` is valid; soft-check failures are surfaced without changing verdicts.
- Evaluator never aborts batches: on LLM failure fall back to `rules-engine-deterministic`; normalize `fit_score` to [0,1]; persisted `grant_evaluations` override heuristics in `toRadarItem`; short-circuit hard fails with deterministic rules (0 tokens) before calling LLM.
- `listGrants` defaults `includeHardBlocked` true and projects evaluation so Radar/Dashboard counts agree.
- Radar logic lives in `src/lib/grant-radar.ts`; `minAmount` defaults 0; search text beats secondary filters.
- Search: `match_grant_search_documents`, with keyword fallback over grants + funders (0 tokens) when <20 vector rows, so search never falsely returns empty.
- Schema changes additive; provision users via idempotent `ensure_current_user()` (no auth triggers); ingest via signed-in `refreshCatalog` (no cron).
- Grants.gov: official structured endpoint before scraping; unpublished fields stay unknown.
- Keep loose TS settings; exclude tests/e2e/fixtures from typecheck.
- Theme via `src/styles.css` tokens (iial.ca style); V2 is the only UI.
