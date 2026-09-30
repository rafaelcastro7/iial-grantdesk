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
- Text AI priority is Cerebras → Groq → Gemini → Lovable; embeddings use Lovable `google/gemini-embedding-2` at 768 dimensions. This minimizes paid traffic without losing fallback reliability.
- Never impose client deadlines on AI calls because aborted generation still completes and bills.
- Keep eligibility deterministic in `src/lib/eligibility.ts`; models never decide verdicts and `unknown` is valid.
- Run catalog ingest and embedding through signed-in `refreshCatalog`; there is no cron.
- Make schema changes additive; deprecate rather than drop columns.
- Keep the intentionally loose synced-code TypeScript settings and exclude tests/e2e/fixtures from typecheck.
- Search `grant_embeddings` through `match_grant_search_documents`; missing runtime config means hybrid mode.
- Provision new users through idempotent `ensure_current_user()` in the authenticated layout because auth-schema triggers are unavailable.
- Surface failed soft eligibility checks without changing their verdict effect.
- Run live cloud/AI tests only with `LIVE_CLOUD=1` to avoid accidental spend.
- Keep Grant Radar ranking, filtering, country grouping, and deterministic prefiltering in `src/lib/grant-radar.ts`.
- Theme through `src/styles.css` semantic tokens, following iial.ca's light institutional style.
- Read Grants.gov detail data from its official structured endpoint before scraping; unpublished fields stay unknown and reduce coverage without failing enrichment.
