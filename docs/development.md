# Development

Stack: React 18, TypeScript (strict), Tailwind, Dexie (IndexedDB), Zod, Recharts, Vitest, Playwright, `vite-plugin-pwa`, `barcode-detector` (ZXing WebAssembly).

## Local development

```bash
npm ci
npx playwright install webkit chromium   # once, for e2e tests
npm run dev                               # http://localhost:5173
```

Scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `e2e`, `format`, and `size` (main-bundle budget check, run after `build`). In development, `/dev/ui` shows the component kit and `/dev/seed` generates demo data.

To test barcode scanning on a phone you need HTTPS: deploy, or use `vite --host` with a local certificate.

## USDA API key

Food search uses [USDA FoodData Central](https://fdc.nal.usda.gov/), which needs a free key from https://fdc.nal.usda.gov/api-key-signup. Set it in either place:

- **Dev:** add `VITE_USDA_API_KEY=...` to `.env.local`.
- **Deploy:** add a repository **Variable** (not a secret) named `USDA_API_KEY`. The key ends up in the public bundle, which is acceptable for this rate-limit-only key.

Without a key the app falls back to the heavily rate-limited `DEMO_KEY`. A key can also be set per device in Settings → Food database.

## Deployment

GitHub Pages via `.github/workflows/deploy.yml`, served at `https://rcstephenson.github.io/myeats/`. In repository Settings → Pages, set Source to **GitHub Actions**. The workflow runs typecheck, lint, unit tests, e2e tests and the size check before publishing.

## Cloud sync (Dexie Cloud, optional)

myeats uses its **own** Dexie Cloud database, separate from trakr's. The free plan allows multiple databases, so both apps can sync for free.

1. From this repo's root, run `npx dexie-cloud create`. It writes `dexie-cloud.json` and `dexie-cloud.key`, both of which are git-ignored and must never be committed.
2. Whitelist the app's origins:
   - `npx dexie-cloud whitelist http://localhost:5173`
   - `npx dexie-cloud whitelist https://rcstephenson.github.io`
3. Set the database URL:
   - **Dev:** `VITE_DEXIE_CLOUD_URL=https://xxxx.dexie.cloud` in `.env.local`.
   - **Deploy:** a repository Variable named `DEXIE_CLOUD_URL`.
4. On each device, go to Settings → Account & sync and sign in with the same email.

## Project documents

- [`SPEC.md`](../SPEC.md): what the app does and how it is built.
- [`design-system.md`](design-system.md): the visual language.
- [`build-plan.md`](build-plan.md): phased milestones, acceptance criteria and the iPhone QA checklist.
- [`requirements.md`](requirements.md): the owner's original answers.
- [`backup-format.md`](backup-format.md): the JSON backup format.
- [`implementation-plan.md`](implementation-plan.md): how the first build was split across parallel agents.
- [`AGENTS.md`](../AGENTS.md): rules for coding agents.
