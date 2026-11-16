# Working rules for coding agents

1. **Read first:** read `SPEC.md`, `docs/design-system.md` and the current phase in `docs/build-plan.md` before writing code. trakr (https://github.com/rcstephenson/trakr) is the reference implementation for conventions. Copy its patterns; don't reinvent them.
2. **One phase at a time.** Implement only the current phase's scope. Put open questions in the PR description instead of guessing product behaviour. Section 11 of the spec records the decisions already made.
3. **Before every merge:** `npm run typecheck`, `npm run lint`, `npm test` and `npm run e2e` must all pass.
4. **Layering:**
   - Business logic goes in `src/domain/`: pure functions with unit tests.
   - UI never queries Dexie directly; it goes through repositories and hooks.
   - Network code lives only in `src/sources/`.
5. **Tests never hit the network.** Mock every USDA and Open Food Facts call with Playwright `page.route` or fixture JSON in `tests/fixtures/`.
6. **Schema changes:** never edit a released Dexie version; add a new version with an upgrade. Never delete user data without explicit confirmation.
7. **Styling:**
   - Colours come only from tokens. Don't hard-code hex values in components.
   - If you add or change a token, update `docs/design-system.md` and its contrast table in the same PR.
8. **Speed is a feature.** Don't add work to the `＋` → focus → type → Add path without measuring it against SPEC §9. New dependencies need a one-line justification in the PR.
9. **No personal data in the repo.** That means goals, weights and food logs. The repo is public.
10. **iPhone first:** check layout and input behaviour against the iPhone QA checklist in the build plan.
