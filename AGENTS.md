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
- Text AI: configured free-tier providers first (Gemini via `GOOGLE_AI_STUDIO_KEY` or Lovable's `GEMINI_API_KEY` → Groq → Cerebras, only when their key is set), Lovable AI Gateway as the paid floor; embeddings Lovable `google/gemini-embedding-2` @768. User chose cost-first ordering (Sep 30 2026); with no external secrets in Lovable Cloud, Lovable AI is effectively the only provider.
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
- Multitenancy: evaluations, profiles and fit rules are strictly scoped by `org_id`; active tenant is driven by session context (`useActiveTenant`), never by mutating `profiles.org_id`.
- Grant Copilot & Backlog: contextual assistant uses active tenant profile and grant evidence; feature requests and gap observations persist in `product_design_backlog`.
- Consortium & America coverage: evaluations distinguish lead applicant vs consortium partner (technical partner WCIS vs territorial/governance lead); support rolling/unsolicited deadlines and in-kind match.
- Strategic Roadmap personalizing: all grant detail roadmap panels (`GrantConsortiumMatrix`, `GrantFinancialHurdles`, `GrantStrategicRevenue`, `GrantOutreachKit`) must consume `activeOrgName` from `useActiveTenant` so identity, email drafts, and fiduciary roles match the active client.
- Postgrest error handling: Supabase query builders (`PostgrestBuilder`) implement `.then()` but lack native `.catch()`; NEVER chain `.catch()` directly on `.from(...).upsert(...)` or `.select(...)`. Wrap in `try { await ... } catch {}` or use `.then(onOk, onErr)`.
- Multi-client staff access: only users listed in `public.platform_staff` (managed by an admin) are members of both `IIAL` and `Nahua Canada`; `ensure_current_user()` never adds org memberships for anyone else.
- Security (never regress): no roles or memberships derived from email patterns; never auto-join a user to an org passed in a request; no blanket `INSERT ... SELECT FROM auth.users` memberships; no `org_id IS NULL` RLS escapes (NULL = private to owner); no credentials, password hashes or plaintext passwords in code, migrations, scripts or comments; no destructive data scripts (DELETE/TRUNCATE on user data) in the repo.
- Application plan: per-grant decisions live in `grant_workspaces` (`src/lib/grant-workspace.*`); the Pipeline (`/pipeline`) reads it. Don't duplicate this state in new panels.
- Language: the interface is bilingual English/Spanish, chosen with the EN/ES toggle in the top bar (`src/lib/ui-lang.ts`). Every user-visible string uses `tr("English", "Español")` (components, via `useTr()`) or a `lang` parameter (pure helpers, default `"en"`); never hard-code a single language. Data from the catalog or AI (titles, summaries, rationales) is shown as is. Emails keep their own recipient-language selector, defaulting to the UI language.
