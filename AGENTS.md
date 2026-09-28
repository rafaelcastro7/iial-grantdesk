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
- All AI goes through the Lovable AI Gateway: `openai/gpt-6-astra` on `/v1/responses` for text, `google/gemini-embedding-2` for embeddings. One provider so failures have one explanation.
- Embeddings are 768 dimensions in both spaces (grants, answer library); the two spaces are never compared to each other.
- No client-side deadlines on gateway calls — an aborted generation still finishes and still bills.
- Eligibility verdicts stay deterministic in `src/lib/eligibility.ts`; the model never decides a verdict, and `unknown` is a real answer rather than a guess.
- Catalog ingest and embedding run through `refreshCatalog` (service role, signed-in trigger) because there is no cron here.
- Schema changes are additive: retired columns get a `DEPRECATED` comment instead of being dropped.
