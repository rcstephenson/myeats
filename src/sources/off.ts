// Open Food Facts client (SPEC §6.3). Barcode lookup only; OFF search is rate-limited, USDA does search.
import type { RemoteFood } from '../domain/types';
import { mapOffProduct, type OffResponse } from '../domain/offMapper';
import { version as APP_VERSION } from '../../package.json';
import { fetchJson, NotFoundError } from './errors';

const APP_NAME = 'MYeats';

const FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity';

/** Query OFF with the code as scanned (OFF normalises itself). null when not found. */
export async function lookupBarcodeOff(code: string, { signal }: { signal?: AbortSignal } = {}): Promise<RemoteFood | null> {
  const url =
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code.trim())}.json` +
    `?fields=${FIELDS}&app_name=${APP_NAME}&app_version=${APP_VERSION}`;
  try {
    return mapOffProduct((await fetchJson(url, { signal })) as OffResponse);
  } catch (e) {
    if (e instanceof NotFoundError) return null;
    throw e;
  }
}
