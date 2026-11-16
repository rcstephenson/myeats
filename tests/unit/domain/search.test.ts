import { describe, expect, it } from 'vitest';
import { buildIndex, fold, search, tokenize } from '../../../src/domain/search';
import { food, meal, recipe } from './factories';

const now = new Date('2026-11-16T12:00:00.000Z');
const idx = (foods = [food()], recipes = [recipe()], meals = [meal()]) =>
  buildIndex(foods, recipes, meals, now);
const ids = (index: ReturnType<typeof idx>, q: string) => search(index, q).map((h) => h.id);

describe('normalisation', () => {
  it('folds accents and case', () => {
    expect(fold('Crème BRÛLÉE')).toBe('creme brulee');
    expect(tokenize("Ben & Jerry's 2%-fat")).toEqual(['ben', 'jerry', 's', '2', 'fat']);
  });
});

describe('matching', () => {
  const index = idx(
    [
      food({ id: 'a', name: 'Crème fraîche', brand: 'Elle' }),
      food({ id: 'b', name: 'Rolled oats', brand: 'Quaker' }),
      food({ id: 'c', name: 'Oat milk' }),
    ],
    [recipe({ id: 'r', name: 'Oat porridge' })],
    [meal({ id: 'm', name: 'Usual breakfast' })],
  );
  it('is accent-insensitive both ways', () => {
    expect(ids(index, 'creme')).toEqual(['a']);
    expect(ids(index, 'FRAÎCHE')).toEqual(['a']);
  });
  it('prefix-matches any name token', () => {
    expect(ids(index, 'oa').sort()).toEqual(['b', 'c', 'r']);
    expect(ids(index, 'oats')).toEqual(['b']);
  });
  it('requires every query token to match', () => {
    expect(ids(index, 'rolled oat')).toEqual(['b']);
    expect(ids(index, 'rolled milk')).toEqual([]);
  });
  it('matches the brand', () => {
    expect(ids(index, 'quak')).toEqual(['b']);
    expect(ids(index, 'oats quaker')).toEqual(['b']);
  });
  it('does not match mid-word', () => {
    expect(ids(index, 'ats')).toEqual([]);
  });
  it('returns [] for an empty or symbol-only query', () => {
    expect(search(index, '')).toEqual([]);
    expect(search(index, ' - ')).toEqual([]);
  });
  it('returns typed hits for foods, recipes and meals', () => {
    const hits = search(index, 'usual');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ kind: 'meal', id: 'm' });
    expect(search(index, 'porridge')[0]).toMatchObject({ kind: 'recipe' });
    expect(search(index, 'milk')[0]).toMatchObject({ kind: 'food' });
  });
  it('respects the limit', () => {
    const many = idx(
      Array.from({ length: 10 }, (_, i) => food({ id: `f${i}`, name: `Apple ${i}` })),
      [],
      [],
    );
    expect(search(many, 'app', 3)).toHaveLength(3);
    expect(search(many, 'app', 0)).toEqual([]);
  });
});

describe('exclusions', () => {
  it('drops deleted items', () => {
    const index = idx(
      [food({ id: 'a', name: 'Apple', deletedAt: 'x' })],
      [recipe({ name: 'Apple pie', deletedAt: 'x' })],
      [meal({ name: 'Apple day', deletedAt: 'x' })],
    );
    expect(search(index, 'apple')).toEqual([]);
  });
  it('drops a remote food that has a custom override', () => {
    const index = idx([
      food({ id: 'remote', source: 'usda', sourceId: '123', name: 'Oats' }),
      food({ id: 'mine', source: 'custom', overrides: 'usda:123', name: 'Oats' }),
      food({ id: 'other', source: 'off', sourceId: '123', name: 'Oats' }),
    ]);
    expect(ids(index, 'oats').sort()).toEqual(['mine', 'other']);
  });
  it('restores the original when the override is deleted', () => {
    const index = idx([
      food({ id: 'remote', source: 'usda', sourceId: '123', name: 'Oats' }),
      food({ id: 'mine', source: 'custom', overrides: 'usda:123', name: 'Oats', deletedAt: 'x' }),
    ]);
    expect(ids(index, 'oats')).toEqual(['remote']);
  });
});

describe('scoring', () => {
  it('prefers an exact name prefix over a later-token match', () => {
    const index = idx(
      [food({ id: 'late', name: 'Whole oats' }), food({ id: 'early', name: 'Oats rolled' })],
      [],
      [],
    );
    expect(ids(index, 'oats')).toEqual(['early', 'late']);
  });
  it('favourites beat non-favourites', () => {
    const index = idx(
      [
        food({ id: 'a', name: 'Rice a' }),
        food({ id: 'b', name: 'Rice b', favoriteAt: '2026-01-01T00:00:00Z' }),
      ],
      [],
      [],
    );
    expect(ids(index, 'rice')[0]).toBe('b');
  });
  it('more use ranks higher', () => {
    const index = idx(
      [
        food({ id: 'a', name: 'Rice a', useCount: 1 }),
        food({ id: 'b', name: 'Rice b', useCount: 30 }),
      ],
      [],
      [],
    );
    expect(ids(index, 'rice')[0]).toBe('b');
  });
  it('recent beats stale, and decays', () => {
    const index = idx(
      [
        food({ id: 'old', name: 'Rice a', lastUsedAt: '2025-01-01T00:00:00Z' }),
        food({ id: 'new', name: 'Rice b', lastUsedAt: '2026-11-15T00:00:00Z' }),
      ],
      [],
      [],
    );
    const hits = search(index, 'rice');
    expect(hits.map((h) => h.id)).toEqual(['new', 'old']);
    expect(hits[0]!.score).toBeGreaterThan(hits[1]!.score);
  });
  it('breaks ties by shorter then alphabetical name', () => {
    const index = idx(
      [
        food({ id: 'b', name: 'Bean soup' }),
        food({ id: 'a', name: 'Bean' }),
        food({ id: 'c', name: 'Bean dip' }),
      ],
      [],
      [],
    );
    expect(ids(index, 'bean')).toEqual(['a', 'c', 'b']);
  });
});

describe('performance', () => {
  it('queries 5,000 items quickly', () => {
    const words = [
      'chicken',
      'rice',
      'oat',
      'milk',
      'apple',
      'bread',
      'cheese',
      'tomato',
      'pasta',
      'bean',
    ];
    const foods = Array.from({ length: 5000 }, (_, i) =>
      food({
        id: `f${i}`,
        name: `${words[i % 10]} ${words[(i * 7) % 10]} ${i}`,
        brand: i % 3 === 0 ? `Brand${i % 50}` : null,
        useCount: i % 17,
        lastUsedAt: i % 5 === 0 ? '2026-11-01T00:00:00Z' : null,
      }),
    );
    const t0 = performance.now();
    const index = buildIndex(foods, [], [], now);
    const buildMs = performance.now() - t0;
    search(index, 'ch'); // warm up
    const queries = ['c', 'chi', 'chicken ri', 'brand1', 'zzz', 'app ch 12'];
    const t1 = performance.now();
    for (const q of queries) search(index, q);
    const perQuery = (performance.now() - t1) / queries.length;
    expect(perQuery).toBeLessThan(25);
    expect(buildMs).toBeLessThan(500);
    expect(search(index, 'chicken')).toHaveLength(30);
  });
});
