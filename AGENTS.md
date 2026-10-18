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

- Read `docs/project-rules.md` before every project change; it preserves all project-wide constraints.
- Discovery link provenance uses exact normalized page citations, never hostname-only matches; citations corroborate links, not eligibility claims, without additional search calls.
- Dossier monetary ranges use one currency family at a time; normalized CAD fields are never mixed with original amounts or labelled with the original currency.

- Workspace saves use the shared schema module so checklist provenance survives validation and readback.
- Catalog browsing reads stable database pages before ranking; the Radar incrementally loads ranked pages without re-fetching previously loaded pages.
- Evaluation polling checks the requested run and cache trace, never accepts an older verdict or reports a timeout as success.
- Grant availability is derived by a shared conservative helper; contradictory closure and future dates require confirmation, never automatic reopening.
- Generated dossiers stay visible after a failed save and retry persistence separately from AI generation, avoiding another paid call.
- Source ingestion propagates partial failures and promotes funders before approving candidates; existing-funder matches reconcile incomplete candidate approvals.
- The grant agent (`/agent`) is one AI SDK tool loop in `src/lib/agent/agent.server.ts`; tools reuse existing deterministic helpers and the UI shows cards only from `show_grants`, so raw search noise never reaches the user. Deep page analysis is delegated to a cheap fast extractor (`src/lib/agent/extractor.server.ts`, Gemini Flash with strict JSON schema + per-field citations) so the orchestrator never invents amounts or dates.
- The agent's live workspace is the `agent_workspace` table (one row per user+grant: status, decision, analysis with citations, tasks with provenance). Chat tools (`analyze_grant`, `save_to_workspace`) and the side panel (`AgentWorkspacePanel`) read/write the same rows, so edits from either side stay in sync; task merging dedupes by normalized label (`agent-workspace.shared.ts`).
- Direct task creation uses authenticated workspace functions and optimistic concurrency with `updated_at`; manual tasks keep user provenance so they never become official requirements or overwrite a concurrent plan update.
- Proactive agent work (`agent_watches` → `agent_inbox`) uses 0-token catalog search in `src/lib/agent/watch.server.ts`; anything sent to third parties requires an explicit user approval.
- Chat Markdown uses AI Elements/Streamdown with CJK, code and math only; keep Mermaid/graphlib out of eager imports because diagram initialization can crash the whole conversation.
