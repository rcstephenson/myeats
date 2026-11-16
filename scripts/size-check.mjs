// Main-bundle budget (SPEC §9): the JS loaded at startup (the entry script plus its modulepreloads)
// must stay under 180 KB gzip. Lazy chunks (scanner, Recharts routes, editors) are excluded.
// Run after `vite build`: `npm run size`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 180;
const dist = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const files = [
  ...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g),
].map((m) => m[1].replace(/^.*?assets\//, 'assets/'));

let total = 0;
for (const file of new Set(files)) {
  const kb = gzipSync(readFileSync(join(dist, file))).length / 1024;
  total += kb;
  console.log(`${kb.toFixed(1).padStart(7)} KB  ${file}`);
}
console.log(`${total.toFixed(1).padStart(7)} KB  total (budget ${BUDGET_KB} KB gzip)`);
if (total > BUDGET_KB) {
  console.error('Main bundle is over budget.');
  process.exit(1);
}
