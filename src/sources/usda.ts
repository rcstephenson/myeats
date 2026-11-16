// USDA FoodData Central client (SPEC §6.2). Network code lives only in src/sources.
import type { RemoteFood, Serving } from '../domain/types';
import { normaliseBarcode } from '../domain/barcode';
import {
  mapUsdaPortions,
  mapUsdaSearch,
  sortGenericFirst,
  type UsdaDetails,
  type UsdaSearchResponse,
} from '../domain/usdaMapper';
import { fetchJson } from './errors';

const BASE = 'https://api.nal.usda.gov/fdc/v1';
const DATA_TYPES = ['Foundation', 'SR Legacy', 'Branded'];

export type UsdaOptions = { signal?: AbortSignal; apiKey: string };

/** Cache-key helper: lowercase, trimmed, whitespace collapsed. Use as `usda:<normaliseQuery(q)>`. */
export function normaliseQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function search(query: string, { signal, apiKey }: UsdaOptions): Promise<RemoteFood[]> {
  const json = (await fetchJson(`${BASE}/foods/search?api_key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, dataType: DATA_TYPES, pageSize: 30 }),
    signal,
  })) as UsdaSearchResponse;
  return mapUsdaSearch(json);
}

/** Search; generic (Foundation / SR Legacy) results first, API order kept within each group. */
export async function searchUsda(query: string, opts: UsdaOptions): Promise<RemoteFood[]> {
  return sortGenericFirst(await search(query, opts));
}

/** Servings (from foodPortions) for a Foundation / SR Legacy food. */
export async function getUsdaDetails(fdcId: string | number, { signal, apiKey }: UsdaOptions): Promise<Serving[]> {
  const json = (await fetchJson(
    `${BASE}/food/${encodeURIComponent(String(fdcId))}?api_key=${encodeURIComponent(apiKey)}`,
    { signal },
  )) as UsdaDetails;
  return mapUsdaPortions(json);
}

/** Branded food whose gtinUpc matches the normalised code, or null. */
export async function lookupBarcodeUsda(gtin: string, opts: UsdaOptions): Promise<RemoteFood | null> {
  const wanted = normaliseBarcode(gtin);
  if (!wanted) return null;
  // Query with the digits as given; USDA indexes gtinUpc as stored (often 12 digits).
  const results = await search(gtin.replace(/\D/g, ''), opts);
  return results.find((f) => f.barcode === wanted) ?? null;
}
