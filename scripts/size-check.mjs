// Startup-bundle budgets (SPEC §9), checked after `vite build` with `npm run size`.
// Counts the JS loaded at startup: the entry script plus its modulepreloads. Lazy chunks (scanner,
// Recharts routes, editors) are excluded.
// - App: everything except the optional Dexie Cloud sync code, under 180 KB gzip.
// - Cloud: the `cloud-*` chunk, present only when VITE_DEXIE_CLOUD_URL is set, under 100 KB gzip.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGETS = { app: 180, cloud: 100 };
const dist = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const files = [
  ...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g),
].map((m) => m[1].replace(/^.*?assets\//, 'assets/'));

const totals = { app: 0, cloud: 0 };
for (const file of new Set(files)) {
  const kb = gzipSync(readFileSync(join(dist, file))).length / 1024;
  const group = /^assets\/cloud-/.test(file) ? 'cloud' : 'app';
  totals[group] += kb;
  console.log(
    `${kb.toFixed(1).padStart(7)} KB  ${file}${group === 'cloud' ? '  (cloud sync)' : ''}`,
  );
}

let failed = false;
for (const [group, budget] of Object.entries(BUDGETS)) {
  if (group === 'cloud' && totals.cloud === 0) continue;
  const over = totals[group] > budget;
  failed ||= over;
  console.log(
    `${totals[group].toFixed(1).padStart(7)} KB  ${group} total (budget ${budget} KB gzip)${over ? '  OVER BUDGET' : ''}`,
  );
}
if (failed) {
  console.error('Startup bundle is over budget.');
  process.exit(1);
}
