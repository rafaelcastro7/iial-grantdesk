# Rocío end-to-end grant workflow

## Goal
Make Rocío's daily workflow reliable and efficient from finding a suitable grant through preparing a submission-ready proposal.

## Work
1. Exercise Rocío's real portal journey: dashboard, Grant Radar, eligibility check, source enrichment, evaluation, proposal creation, drafting, review, and submission readiness.
2. Capture functional, wording, navigation, loading, and error-handling issues encountered in that journey.
3. Fix confirmed blockers and high-value friction only, including the obsolete Ollama status and guidance.
4. Preserve deterministic eligibility: rules classify opportunities before AI analysis, and unclear facts remain explicit.
5. Add or update focused automated coverage for every corrected workflow behavior.
6. Re-run the complete Rocío journey and verify the visible result on desktop.

## Technical details
- Keep external AI first: Cerebras → Groq → Gemini → Lovable AI fallback.
- Keep embeddings on Lovable AI and all user data in Lovable Cloud.
- Reuse existing TanStack routes, design tokens, server functions, and access controls.
- Avoid spending AI credits except where a real end-to-end generation is required to prove the central flow.

## Done when
- Rocío can sign in, identify a prioritized opportunity, understand eligibility, start or open a proposal, progress its content, and see clear readiness blockers.
- No user-facing text claims Ollama or local-only AI.
- The current build and focused automated checks pass, with the central flow verified in the portal.