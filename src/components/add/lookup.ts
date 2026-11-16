import { normaliseBarcode } from '../../domain/barcode';
import type { Food, RemoteFood } from '../../domain/types';
import { OfflineError } from '../../sources/errors';

export type LookupDeps = {
  byBarcode(gtin: string): Promise<Food | undefined>;
  off(code: string, opts: { signal?: AbortSignal }): Promise<RemoteFood | null>;
  usda(code: string, opts: { signal?: AbortSignal; apiKey: string }): Promise<RemoteFood | null>;
  apiKey: string;
  signal?: AbortSignal;
};

export type LookupResult =
  | { kind: 'local'; food: Food }
  | { kind: 'remote'; remote: RemoteFood }
  | { kind: 'none' }
  | { kind: 'error'; offline: boolean };

/**
 * Scanner lookup chain (SPEC 3.3): local barcode, then Open Food Facts, then USDA Branded.
 * A failing source does not stop the chain; if nothing matched and something failed the
 * result is an error rather than "no match".
 */
export async function lookupBarcode(raw: string, deps: LookupDeps): Promise<LookupResult> {
  const gtin = normaliseBarcode(raw);
  if (gtin === null) return { kind: 'none' };
  const local = await deps.byBarcode(gtin);
  if (local) return { kind: 'local', food: local };

  let failed = false;
  let offline = false;
  const note = (e: unknown): void => {
    if (typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError') {
      throw e;
    }
    failed = true;
    if (e instanceof OfflineError) offline = true;
  };

  try {
    const hit = await deps.off(raw, { signal: deps.signal });
    if (hit) return { kind: 'remote', remote: hit };
  } catch (e) {
    note(e);
  }
  try {
    const hit = await deps.usda(raw, { signal: deps.signal, apiKey: deps.apiKey });
    if (hit) return { kind: 'remote', remote: hit };
  } catch (e) {
    note(e);
  }
  return failed ? { kind: 'error', offline } : { kind: 'none' };
}
