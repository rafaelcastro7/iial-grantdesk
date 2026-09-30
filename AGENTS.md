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

- Server functions live in `src/lib/*.functions.ts`; server-only modules stay in `src/server/` and are loaded with `await import(...)` inside handler bodies. The template's import protection blocks `src/server/` from the client bundle, and only handler bodies are stripped from it.
- All AI goes through the Lovable AI Gateway: `openai/gpt-6-astra` on `/v1/responses` for text, `google/gemini-embedding-2` for embeddings. One provider so failures have one explanation. The GitHub-synced Cerebras/Groq/Gemini/Ollama chain was removed: `src/agents/llm.server.ts`, `llm-free.server.ts`, `embeddings.server.ts` and `model-router.server.ts` are thin adapters over `src/server/llm.ts` and `src/server/embed.ts`, keeping their old exported signatures so callers stay unchanged.
- Embeddings are 768 dimensions in both spaces (grants, answer library); the two spaces are never compared to each other.
- No client-side deadlines on gateway calls — an aborted generation still finishes and still bills.
- Eligibility verdicts stay deterministic in `src/lib/eligibility.ts`; the model never decides a verdict, and `unknown` is a real answer rather than a guess.
- Catalog ingest and embedding run through `refreshCatalog` (service role, signed-in trigger) because there is no cron here.
- Schema changes are additive: retired columns get a `DEPRECATED` comment instead of being dropped.

- Typecheck excludes test/e2e/fixture files and disables noPropertyAccessFromIndexSignature, noUncheckedIndexedAccess and exactOptionalPropertyTypes — the synced GitHub code was written against those looser settings.

- Semantic catalog search reads `grant_embeddings` (model `gemini-embedding-2/768`) through `match_grant_search_documents`; `grant_search_documents` is deprecated. A missing `grant_search_runtime_config` row means hybrid mode, not lexical-only — a silent default to lexical hid half the retrieval.
- New users get their profile + default role from the idempotent `ensure_current_user()` RPC called in the `_authenticated` layout, because triggers on the auth schema are not allowed here.
- Eligibility headline surfaces a failed soft check (e.g. short runway) instead of "meets every requirement"; soft checks still never flip the verdict.
- Live synthetic tests (`src/evals/grant-search.live.test.ts`) hit the real cloud database and AI gateway and run only with `LIVE_CLOUD=1`; the default unit run spends no credits.
