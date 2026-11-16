import type { Food, Recipe, SavedMeal } from './types';

// Local search (SPEC 6.1): accent-folded, tokenised, every query token must prefix-match a name or
// brand token. Build once, then query many times.

/** Lower-case and strip accents/combining marks. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Fold, then split on non-alphanumerics. */
export function tokenize(s: string): string[] {
  return fold(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

export type SearchHit =
  | { kind: 'food'; id: string; item: Food; score: number }
  | { kind: 'recipe'; id: string; item: Recipe; score: number }
  | { kind: 'meal'; id: string; item: SavedMeal; score: number };

type Indexed = {
  hit: Omit<SearchHit, 'score'>;
  /** Folded name, space-joined tokens, for the exact-name-prefix bonus. */
  nameKey: string;
  tokens: string[];
  /** Query-independent score: favourite + log(1 + useCount) + recency. */
  base: number;
};

export type SearchIndex = { items: Indexed[] };

export const SCORE = {
  prefixBonus: 3,
  favouriteBonus: 2,
  /** Max recency boost; halves roughly every 3 weeks. */
  recencyMax: 1.5,
  recencyHalfLifeDays: 21,
} as const;

const DAY_MS = 86_400_000;

function baseScore(
  m: { useCount: number; lastUsedAt: string | null; favoriteAt: string | null },
  nowMs: number,
): number {
  let s = Math.log(1 + Math.max(0, m.useCount));
  if (m.favoriteAt) s += SCORE.favouriteBonus;
  if (m.lastUsedAt) {
    const t = Date.parse(m.lastUsedAt);
    if (!Number.isNaN(t)) {
      const days = Math.max(0, (nowMs - t) / DAY_MS);
      s += SCORE.recencyMax * Math.pow(0.5, days / SCORE.recencyHalfLifeDays);
    }
  }
  return s;
}

/**
 * Index non-deleted foods, recipes and meals. A remote food replaced by a non-deleted custom
 * override (`overrides === "source:sourceId"`) is left out.
 */
export function buildIndex(
  foods: readonly Food[],
  recipes: readonly Recipe[],
  meals: readonly SavedMeal[],
  now: Date,
): SearchIndex {
  const nowMs = now.getTime();
  const overridden = new Set<string>();
  for (const f of foods) if (f.overrides && f.deletedAt === null) overridden.add(f.overrides);

  const items: Indexed[] = [];
  const push = (
    hit: Omit<SearchHit, 'score'>,
    name: string,
    brand: string | null,
    m: { useCount: number; lastUsedAt: string | null; favoriteAt: string | null },
  ): void => {
    const nameTokens = tokenize(name);
    items.push({
      hit,
      nameKey: nameTokens.join(' '),
      tokens: brand ? nameTokens.concat(tokenize(brand)) : nameTokens,
      base: baseScore(m, nowMs),
    });
  };

  for (const f of foods) {
    if (f.deletedAt !== null) continue;
    if (
      f.source !== 'custom' &&
      f.sourceId !== null &&
      overridden.has(`${f.source}:${f.sourceId}`)
    ) {
      continue;
    }
    push({ kind: 'food', id: f.id, item: f }, f.name, f.brand, f);
  }
  for (const r of recipes) {
    if (r.deletedAt === null) push({ kind: 'recipe', id: r.id, item: r }, r.name, null, r);
  }
  for (const m of meals) {
    if (m.deletedAt === null) push({ kind: 'meal', id: m.id, item: m }, m.name, null, m);
  }
  return { items };
}

/** Best matches first. An empty query returns []. Ties break on shorter, then alphabetical name. */
export function search(index: SearchIndex, query: string, limit = 30): SearchHit[] {
  const q = tokenize(query);
  if (q.length === 0 || limit <= 0) return [];
  const qKey = q.join(' ');
  const scored: { it: Indexed; score: number }[] = [];
  for (const it of index.items) {
    const toks = it.tokens;
    let ok = true;
    for (const qt of q) {
      let found = false;
      for (let i = 0; i < toks.length; i++) {
        if ((toks[i] as string).startsWith(qt)) {
          found = true;
          break;
        }
      }
      if (!found) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    scored.push({ it, score: it.base + (it.nameKey.startsWith(qKey) ? SCORE.prefixBonus : 0) });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.it.nameKey.length - b.it.nameKey.length ||
      (a.it.nameKey < b.it.nameKey ? -1 : a.it.nameKey > b.it.nameKey ? 1 : 0),
  );
  return scored.slice(0, limit).map(({ it, score }) => ({ ...it.hit, score }) as SearchHit);
}
