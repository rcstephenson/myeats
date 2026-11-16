import { describe, expect, it } from 'vitest';
import {
  NUTRITION_KEY,
  buildFoodFields,
  draftFromFood,
  emptyDraft,
  netCarbsOf,
  toPer100,
} from '../../../src/components/foods/foodDraft';
import { visibleFoods } from '../../../src/components/foods/library';
import { food, nut } from '../domain/factories';

describe('toPer100', () => {
  it('scales per-serving values to 100 g and keeps blanks null', () => {
    const out = toPer100(
      nut({ kcal: 180, protein: 20, carbs: 18, fat: null, sodium: 0 }),
      'serving',
      45,
    );
    expect(out?.kcal).toBe(400);
    expect(out?.protein).toBe(44.444);
    expect(out?.carbs).toBe(40);
    expect(out?.fat).toBeNull();
    expect(out?.sodium).toBe(0);
  });
  it('passes per-100 values through and rejects a missing serving amount', () => {
    expect(toPer100(nut({ kcal: 50 }), 'per100', null)?.kcal).toBe(50);
    expect(toPer100(nut({ kcal: 50 }), 'serving', null)).toBeNull();
    expect(toPer100(nut({ kcal: 50 }), 'serving', 0)).toBeNull();
  });
});

describe('buildFoodFields', () => {
  const base = () => ({ ...emptyDraft(), name: ' Bar ', values: nut({ kcal: 180, protein: 20 }) });

  it('requires name and kcal', () => {
    const r = buildFoodFields({ ...emptyDraft() });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['kcal', 'name']);
  });

  it('adds the nutrition serving automatically and makes it default', () => {
    const r = buildFoodFields({ ...base(), mode: 'serving', nutLabel: '1 bar', nutAmount: 45 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fields.name).toBe('Bar');
      expect(r.fields.per100.kcal).toBe(400);
      expect(r.fields.servings).toHaveLength(1);
      expect(r.fields.servings[0]).toMatchObject({ label: '1 bar', amount: 45 });
      expect(r.fields.defaultServingId).toBe(r.fields.servings[0].id);
    }
  });

  it('does not duplicate a matching serving row and keeps its id', () => {
    const r = buildFoodFields({
      ...base(),
      mode: 'serving',
      nutLabel: '1 bar',
      nutAmount: 45,
      servings: [{ key: 'k', id: 'keep', label: '1 Bar', amount: 45 }],
    });
    expect(r.ok && r.fields.servings.map((s) => s.id)).toEqual(['keep']);
  });

  it('validates the barcode and normalises UPC-A to GTIN-13', () => {
    expect(buildFoodFields({ ...base(), barcode: '123' }).ok).toBe(false);
    const r = buildFoodFields({ ...base(), barcode: '016459200441' });
    expect(r.ok && r.fields.barcode).toBe('0016459200441');
  });

  it('round-trips an existing food and honours its default serving', () => {
    const f = food();
    const r = buildFoodFields(draftFromFood(f));
    expect(r.ok && r.fields.per100).toEqual(f.per100);
    expect(r.ok && r.fields.defaultServingId).toBe('s1');
  });

  it('rejects half-filled serving rows but ignores blank ones', () => {
    const blank = { key: 'a', id: 'a', label: '', amount: null };
    expect(buildFoodFields({ ...base(), servings: [blank] }).ok).toBe(true);
    expect(buildFoodFields({ ...base(), servings: [{ ...blank, label: '1 cup' }] }).ok).toBe(false);
  });

  it('unused NUTRITION_KEY default falls back to the first serving', () => {
    const r = buildFoodFields({
      ...base(),
      defaultKey: NUTRITION_KEY,
      servings: [{ key: 'a', id: 'a', label: '1 cup', amount: 240 }],
    });
    expect(r.ok && r.fields.defaultServingId).toBe('a');
  });
});

describe('netCarbsOf / visibleFoods', () => {
  it('derives net carbs and never goes negative', () => {
    expect(netCarbsOf({ carbs: 30, fiber: 8 })).toBe(22);
    expect(netCarbsOf({ carbs: 3, fiber: 8 })).toBe(0);
    expect(netCarbsOf({ carbs: null, fiber: null })).toBe(0);
  });
  it('hides remote originals that have an override, favourites first', () => {
    const orig = food({ id: 'o', source: 'usda', sourceId: '1', name: 'Orig' });
    const over = food({ id: 'v', overrides: 'usda:1', name: 'Mine' });
    const fav = food({ id: 'f', name: 'Zed', favoriteAt: 'x' });
    const out = visibleFoods([orig, over, fav]).map((f) => f.id);
    expect(out).toEqual(['f', 'v']);
  });
});
