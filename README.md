# Grantdesk Integration

IMPLEMENTA ESTE REPOSITORIO EN LOVABLE Y GARANTIZA QUE FUNCIONA. https://github.com/rafaelcastro7/grantdesk

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://iial-grantdesk.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/979df49d-abd9-41e1-a305-d1e266b49dc3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Quality Assurance & Testing

The repository includes a comprehensive deterministic test suite and synthetic end-to-end agents:

```sh
# Run full unit and integration test suite (324 tests across 50 suites)
npm test

# Run synthetic end-to-end suite (Ingestion, Requirements, Remediation, Multi-tenant)
npm run test:synthetic

# Run code style & lint audits
npm run lint
npm run format

# Run Playwright synthetic agent specs
npm run test:e2e
```

### Core Architecture & SOP Rules

- **Deterministic Evaluation First:** Uses IIAL SOP filters (applicant types, cost share, runway, jurisdiction) to short-circuit hard failures with 0 tokens before invoking LLMs.
- **Requirements Synthesis:** Grants automatically synthesize mandatory deliverables (narrative, budget, co-funding, compliance) so checklists are never empty.
- **Remediation Loop (Subsanación):** When a grant fails on misaligned extracted facts (e.g., outdated cost-share or applicant restriction), consultants can update manual facts via `manual_fields` and trigger `Re-check fit` (`force: true`) to recalculate eligibility and unlock proposal drafting.
- **Multi-Tenant Security:** Organization proposals and shared sections are strictly segregated from individual private drafts and other tenants.
- **Lovable Sync:** Push forward commits directly to `origin/main` to sync with the Lovable editor. Never force-push or rewrite git history.
