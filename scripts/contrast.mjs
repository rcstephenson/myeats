// WCAG 2.x contrast for the pairs in docs/design-system.md §2.1, from the hex values in
// src/styles/index.css. Usage: node scripts/contrast.mjs
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8');

function block(selectorRe) {
  const m = css.match(new RegExp(`${selectorRe}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`no block for ${selectorRe}`);
  return Object.fromEntries(
    [...m[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((x) => [x[1], x[2]]),
  );
}

const themes = {
  Oat: block(String.raw`:root,\s*\[data-theme='light'\]`),
  Espresso: block(String.raw`\[data-theme='dark'\]`),
};

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const surfaces = ['bg', 'surface', 'raised'];
const rows = [
  ['accent-ink as text', 'accent-ink', surfaces],
  ['accent fill', 'accent', surfaces],
  ['protein', 'protein', surfaces],
  ['carbs', 'carbs', surfaces],
  ['fat', 'fat', surfaces],
  ['danger', 'danger', surfaces],
  ['muted text', 'muted', surfaces],
  ['hairline-strong', 'hairline-strong', surfaces],
];

const fmt = (t, fg, bgs) =>
  bgs.map((bg) => contrast(themes[t][fg], themes[t][bg]).toFixed(2)).join(' / ');

console.log('| Pair | Oat (bg / surface / raised) | Espresso (bg / surface / raised) |');
console.log('|---|---|---|');
for (const [name, fg, bgs] of rows) {
  console.log(`| ${name} | ${fmt('Oat', fg, bgs)} | ${fmt('Espresso', fg, bgs)} |`);
}
const oa = (t) => contrast(themes[t]['on-accent'], themes[t].accent).toFixed(2);
console.log(`| on-accent on accent | ${oa('Oat')} | ${oa('Espresso')} |`);
const op = (t) => contrast(themes[t]['on-primary'], themes[t].primary).toFixed(2);
console.log(`| on-primary on primary | ${op('Oat')} | ${op('Espresso')} |`);
