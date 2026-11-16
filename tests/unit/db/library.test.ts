import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { foods, meals, recipes } from '../../../src/db/repositories';
import { loadRecents } from '../../../src/hooks/useRecents';
import { makeFood, makeRemote, resetDb } from './helpers';

beforeEach(resetDb);

describe('foods', () => {
  it('save sets nameLower and list hides deleted', async () => {
    await foods.save(makeFood({ name: 'Greek Yogurt', nameLower: '' }));
    await foods.save(makeFood({ id: 'f2', name: 'Gone' }));
    await foods.softDelete('f2');
    const list = await foods.list();
    expect(list.map((f) => f.id)).toEqual(['f1']);
    expect(list[0]!.nameLower).toBe('greek yogurt');
    expect((await foods.get('f2'))!.deletedAt).not.toBeNull();
  });

  it('toggleFavorite flips the timestamp', async () => {
    await foods.save(makeFood());
    await foods.toggleFavorite('f1');
    expect((await foods.get('f1'))!.favoriteAt).not.toBeNull();
    await foods.toggleFavorite('f1');
    expect((await foods.get('f1'))!.favoriteAt).toBeNull();
  });

  it('upsertRemote keys on source+sourceId and keeps id and usage', async () => {
    const a = await foods.upsertRemote(makeRemote());
    await foods.save({ ...a, useCount: 4, favoriteAt: 'fav' });
    const b = await foods.upsertRemote(makeRemote({ name: 'Apple v2' }));
    expect(b.id).toBe(a.id);
    expect(b.name).toBe('Apple v2');
    expect(b.nameLower).toBe('apple v2');
    expect(b.useCount).toBe(4);
    expect(b.favoriteAt).toBe('fav');
    expect(await foods.list()).toHaveLength(1);
    const off = await foods.upsertRemote(makeRemote({ source: 'off', sourceId: '123' }));
    expect(off.id).not.toBe(a.id);
    expect('dataType' in off).toBe(false);
  });

  it('byBarcode prefers a live override, then falls back to the original', async () => {
    const orig = await foods.upsertRemote(
      makeRemote({ source: 'off', sourceId: '0012345678905', barcode: '0012345678905' }),
    );
    expect((await foods.byBarcode('0012345678905'))!.id).toBe(orig.id);
    const ov = await foods.saveOverride(orig, { name: 'My version' });
    expect(ov.overrides).toBe('off:0012345678905');
    expect(ov.source).toBe('custom');
    expect(ov.id).not.toBe(orig.id);
    expect((await foods.byBarcode('0012345678905'))!.id).toBe(ov.id);
    expect((await foods.byOverrideKey('off:0012345678905'))!.id).toBe(ov.id);
    expect((await foods.get(orig.id))!.name).toBe('Apple');
    await foods.softDelete(ov.id);
    expect((await foods.byBarcode('0012345678905'))!.id).toBe(orig.id);
    expect(await foods.byOverrideKey('off:0012345678905')).toBeUndefined();
    expect(await foods.byBarcode('nope')).toBeUndefined();
  });

  it('saveOverride uses usda key and reuses an existing override', async () => {
    const orig = await foods.upsertRemote(makeRemote());
    const a = await foods.saveOverride(orig, { name: 'One' });
    const b = await foods.saveOverride(orig, { name: 'Two' });
    expect(a.overrides).toBe('usda:123');
    expect(b.id).toBe(a.id);
    expect(b.name).toBe('Two');
    await expect(foods.saveOverride(makeFood(), {})).rejects.toThrow();
  });
});

describe('recipes and meals', () => {
  it('save, list, favourite, soft delete', async () => {
    await recipes.save({
      id: 'r1', name: 'Chili', nameLower: '', ingredients: [], servingsPerBatch: 4, cookedWeightG: null,
      lastAmount: null, useCount: 0, lastUsedAt: null, favoriteAt: null, deletedAt: null,
      createdAt: 'x', updatedAt: 'x',
    });
    await meals.save({
      id: 'm1', name: 'Usual', nameLower: '', items: [], defaultCategoryId: null, useCount: 0,
      lastUsedAt: null, favoriteAt: null, deletedAt: null, createdAt: 'x', updatedAt: 'x',
    });
    expect((await recipes.get('r1'))!.nameLower).toBe('chili');
    await recipes.toggleFavorite('r1');
    expect((await recipes.get('r1'))!.favoriteAt).not.toBeNull();
    await meals.toggleFavorite('m1');
    expect((await meals.get('m1'))!.favoriteAt).not.toBeNull();
    await recipes.softDelete('r1');
    await meals.softDelete('m1');
    expect(await recipes.list()).toEqual([]);
    expect(await meals.list()).toEqual([]);
  });
});

describe('recents', () => {
  it('merges kinds by lastUsedAt, skips deleted, hides overridden originals, caps', async () => {
    const orig = await foods.upsertRemote(makeRemote());
    await foods.save({ ...orig, lastUsedAt: '2026-03-01T01:00:00Z' });
    await foods.save(makeFood({ id: 'f2', lastUsedAt: '2026-03-01T03:00:00Z' }));
    await foods.save(makeFood({ id: 'f3', lastUsedAt: '2026-03-01T04:00:00Z', deletedAt: 'd' }));
    await foods.save(makeFood({ id: 'f4' }));
    await recipes.save({
      id: 'r1', name: 'R', nameLower: '', ingredients: [], servingsPerBatch: 1, cookedWeightG: null,
      lastAmount: null, useCount: 1, lastUsedAt: '2026-03-01T02:00:00Z', favoriteAt: null,
      deletedAt: null, createdAt: 'x', updatedAt: 'x',
    });
    let r = await loadRecents();
    expect(r.map((x) => x.item.id)).toEqual(['f2', 'r1', orig.id]);
    const ov = await foods.saveOverride(orig, { name: 'Mine', lastUsedAt: '2026-03-01T05:00:00Z' });
    r = await loadRecents();
    expect(r.map((x) => x.item.id)).toEqual([ov.id, 'f2', 'r1']);
    expect(r[1]!.kind).toBe('food');
    expect(r[2]!.kind).toBe('recipe');
    expect(await loadRecents(2)).toHaveLength(2);
  });
});
