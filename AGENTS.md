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
