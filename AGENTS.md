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
- Text AI: configured free-tier providers first (Gemini → Groq → Cerebras, only when their key is set), Lovable AI Gateway as the paid floor; embeddings Lovable `google/gemini-embedding-2` @768. User chose cost-first ordering (Sep 30 2026); with no external secrets in Lovable Cloud, Lovable AI is effectively the only provider.
- No client deadlines on AI calls (aborted generations still bill); live AI tests only with `LIVE_CLOUD=1`.
- Eligibility is deterministic in `src/lib/eligibility.ts`; `unknown` is valid; soft-check failures are surfaced without changing verdicts.
- Evaluator never aborts batches: on LLM failure fall back to `rules-engine-deterministic`; normalize `fit_score` to [0,1]; persisted `grant_evaluations` override heuristics in `toRadarItem`; short-circuit hard fails with deterministic rules (0 tokens) before calling LLM.
- `listGrants` defaults `includeHardBlocked` true and projects evaluation so Radar/Dashboard counts agree.
- Radar logic lives in `src/lib/grant-radar.ts`; `minAmount` defaults 0; search text beats secondary filters.
- Search: `match_grant_search_documents`, with keyword fallback over grants + funders (0 tokens) when <20 vector rows, so search never falsely returns empty.
- Schema changes additive; provision users via idempotent `ensure_current_user()` (no auth triggers); ingest via signed-in `refreshCatalog` (no cron).
- Funder registration: always use atomic upsert on `(name, country)` with fallback lookup in `src/lib/grants.functions.ts` to prevent unique constraint failures (`funders_name_country_key`).
- Grant requirements & brief updates: use `supabaseAdmin.update()` with safe promise rejection handling (`.then(() => {}, () => {})`) inside server functions to bypass RLS blocks on the public `grants` table.
- Remediation loop (subsanación): manual fact corrections in `manual_fields` trigger deterministic re-evaluation via `Re-check fit` (`force: true`), unlocking `draftGate` when criteria pass.
- Synthetic testing: run deterministic synthetic E2E via `npm run test:synthetic` (covers ingestion, RFP requirements synthesis, decision math, remediation, and tenant isolation).
- Grants.gov: official structured endpoint before scraping; unpublished fields stay unknown.
- Enrichment: semantic windowing (`targeted-chunks.server.ts`, 70% token savings); early-exit deep crawl and LLM gap-fill if deadline is closed/expired (0 tokens); conditional critic in requirements extraction when primary pass is high confidence.
- Keep loose TS settings; exclude tests/e2e/fixtures from typecheck.
- Theme via `src/styles.css` tokens (iial.ca style); V2 is the only UI.
