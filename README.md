# MYeats

MYeats is a local-first, mobile-first progressive web app for logging food and tracking calories, macros (protein, net carbs, fat), fiber, sugar, saturated fat and sodium against a daily goal, plus body-weight weigh-ins. It is a companion to [trakr](https://github.com/rcstephenson/trakr), with the same stack and look and separate data.

Stack: React 18, TypeScript (strict), Tailwind, Dexie (IndexedDB), Zod, Recharts, Vitest, Playwright, `vite-plugin-pwa`, `barcode-detector` (ZXing WebAssembly).

> Status: specification. Implementation follows [`docs/build-plan.md`](docs/build-plan.md).

## Documentation

- [`SPEC.md`](SPEC.md): what the app does and how it is built.
- [`docs/design-system.md`](docs/design-system.md): the visual language (trakr's Signal with an orange accent).
- [`docs/build-plan.md`](docs/build-plan.md): phased milestones and acceptance criteria.
- [`docs/requirements.md`](docs/requirements.md): the owner's original answers.
- [`AGENTS.md`](AGENTS.md): rules for coding agents.

## Data lives on your device

All data is stored in IndexedDB in the browser you use. iOS can clear storage for sites that aren't installed to the home screen, so **install the app** (Share → Add to Home Screen) and **export a JSON backup regularly** from Settings, or turn on cloud sync.

## Food data

Search uses [USDA FoodData Central](https://fdc.nal.usda.gov/). Barcodes use [Open Food Facts](https://world.openfoodfacts.org/) (ODbL), falling back to USDA Branded foods. Results you open or log are cached on the device, so they work offline.

The USDA API needs a free key from https://fdc.nal.usda.gov/api-key-signup. Set it in either place:

- **Dev:** add `VITE_USDA_API_KEY=...` to `.env.local`.
- **Deploy:** add a repository **Variable** (not a secret) named `USDA_API_KEY`. The key ends up in the public bundle, which is acceptable for this rate-limit-only key.

Without a key the app falls back to the heavily rate-limited `DEMO_KEY`. You can also set a key per device in Settings → Food database.

## Local development

```bash
npm ci
npx playwright install webkit chromium   # once, for e2e tests
npm run dev                               # http://localhost:5173
```

The scripts are the same as trakr's: `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `e2e`, `format`.

To test barcode scanning on a phone you need HTTPS: deploy, or use `vite --host` with a local certificate.

## Deployment

Deployment works the same as trakr: GitHub Pages via `.github/workflows/deploy.yml`, served at `https://rcstephenson.github.io/myeats/`. In repository Settings → Pages, set Source to **GitHub Actions**.

## Cloud sync (Dexie Cloud, optional)

MYeats uses its **own** Dexie Cloud database, separate from trakr's. The free plan allows multiple databases, so both apps can sync for free.

1. From this repo's root, run `npx dexie-cloud create`. It writes `dexie-cloud.json` and `dexie-cloud.key`, both of which are git-ignored and must never be committed.
2. Whitelist the app's origins:
   - `npx dexie-cloud whitelist http://localhost:5173`
   - `npx dexie-cloud whitelist https://rcstephenson.github.io`
3. Set the database URL:
   - **Dev:** `VITE_DEXIE_CLOUD_URL=https://xxxx.dexie.cloud` in `.env.local`.
   - **Deploy:** a repository Variable named `DEXIE_CLOUD_URL`.
4. On each device, go to Settings → Account & sync and sign in with the same email.
