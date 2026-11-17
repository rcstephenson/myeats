import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getUsdaDetails, lookupBarcodeUsda, normaliseQuery, searchUsda } from '../../../src/sources/usda';
import { lookupBarcodeOff } from '../../../src/sources/off';
import { NotFoundError, OfflineError, RateLimitError, SourceError } from '../../../src/sources/errors';
import { resolveUsdaKey } from '../../../src/sources/usdaKey';
import banana from '../../fixtures/usda/search-banana.json';
import gtin from '../../fixtures/usda/search-gtin-016459200441.json';
import details from '../../fixtures/usda/details-173944.json';
import nutella from '../../fixtures/off/3017620422003.json';
import notFound from '../../fixtures/off/not-found.json';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('normaliseQuery', () => {
  it('lowercases, trims and collapses whitespace', () => {
    expect(normaliseQuery('  Greek   YOGURT \n')).toBe('greek yogurt');
  });
});

describe('searchUsda', () => {
  it('posts the documented request and returns generic-first results', async () => {
    fetchMock.mockResolvedValue(json(banana));
    const ctrl = new AbortController();
    const res = await searchUsda('banana', { apiKey: 'K EY', signal: ctrl.signal });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.nal.usda.gov/fdc/v1/foods/search?api_key=K%20EY');
    expect(init.method).toBe('POST');
    expect(init.signal).toBe(ctrl.signal);
    expect(JSON.parse(init.body as string)).toEqual({
      query: 'banana',
      dataType: ['Foundation', 'SR Legacy', 'Branded'],
      pageSize: 30,
    });
    expect(res).toHaveLength(8);
    expect(res[0]?.dataType).not.toBe('Branded');
    expect(res.at(-1)?.dataType).toBe('Branded');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps 429 to RateLimitError without retrying', async () => {
    fetchMock.mockResolvedValue(json({}, 429));
    await expect(searchUsda('x', { apiKey: 'k' })).rejects.toBeInstanceOf(RateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps fetch TypeError to OfflineError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(searchUsda('x', { apiKey: 'k' })).rejects.toBeInstanceOf(OfflineError);
  });

  it('throws OfflineError without fetching when navigator.onLine is false', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await expect(searchUsda('x', { apiKey: 'k' })).rejects.toBeInstanceOf(OfflineError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propagates AbortError as-is', async () => {
    const abort = new DOMException('Aborted', 'AbortError');
    fetchMock.mockRejectedValue(abort);
    await expect(searchUsda('x', { apiKey: 'k' })).rejects.toBe(abort);
  });

  it('maps other HTTP failures to SourceError', async () => {
    fetchMock.mockResolvedValue(json({}, 500));
    const err = await searchUsda('x', { apiKey: 'k' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceError);
    expect((err as SourceError).status).toBe(500);
  });
});

describe('getUsdaDetails', () => {
  it('GETs the food and returns servings', async () => {
    fetchMock.mockResolvedValue(json(details));
    const s = await getUsdaDetails('173944', { apiKey: 'DEMO_KEY' });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.nal.usda.gov/fdc/v1/food/173944?api_key=DEMO_KEY');
    expect(s).toHaveLength(8);
  });
  it('maps 404 to NotFoundError', async () => {
    fetchMock.mockResolvedValue(json({}, 404));
    await expect(getUsdaDetails(1, { apiKey: 'k' })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('lookupBarcodeUsda', () => {
  it('finds the branded food by normalised gtinUpc', async () => {
    fetchMock.mockResolvedValue(json(gtin));
    const f = await lookupBarcodeUsda('0016459200441', { apiKey: 'k' });
    expect(f?.sourceId).toBe('2012128');
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as { query: string };
    expect(body.query).toBe('0016459200441');
  });
  it('returns null when nothing matches, and for invalid codes without fetching', async () => {
    fetchMock.mockResolvedValue(json(banana));
    expect(await lookupBarcodeUsda('3017620422003', { apiKey: 'k' })).toBeNull();
    fetchMock.mockClear();
    expect(await lookupBarcodeUsda('123', { apiKey: 'k' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('lookupBarcodeOff', () => {
  it('requests the product with fields and app identification, using the code as scanned', async () => {
    fetchMock.mockResolvedValue(json(nutella));
    const f = await lookupBarcodeOff('3017620422003');
    const url = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(url.origin + url.pathname).toBe('https://world.openfoodfacts.org/api/v2/product/3017620422003.json');
    expect(url.searchParams.get('app_name')).toBe('myeats');
    expect(url.searchParams.get('app_version')).toBe('0.1.0');
    expect(url.searchParams.get('fields')).toBe('code,product_name,brands,nutriments,serving_size,serving_quantity');
    expect(f?.name).toBe('Nutella');
  });
  it('returns null for status 0 and for HTTP 404', async () => {
    fetchMock.mockResolvedValueOnce(json(notFound));
    expect(await lookupBarcodeOff('0000000000017')).toBeNull();
    fetchMock.mockResolvedValueOnce(json(notFound, 404));
    expect(await lookupBarcodeOff('0000000000017')).toBeNull();
  });
  it('maps 429, offline and abort like USDA', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 429));
    await expect(lookupBarcodeOff('1')).rejects.toBeInstanceOf(RateLimitError);
    fetchMock.mockRejectedValueOnce(new TypeError('x'));
    await expect(lookupBarcodeOff('1')).rejects.toBeInstanceOf(OfflineError);
    const abort = new DOMException('Aborted', 'AbortError');
    fetchMock.mockRejectedValueOnce(abort);
    await expect(lookupBarcodeOff('1', { signal: new AbortController().signal })).rejects.toBe(abort);
  });
});

describe('resolveUsdaKey', () => {
  it('prefers the device key, then the build key, then DEMO_KEY', () => {
    expect(resolveUsdaKey(' dev ')).toEqual({ key: 'dev', source: 'device' });
    expect(resolveUsdaKey(null)).toEqual({ key: 'DEMO_KEY', source: 'demo' }); // test env sets build key ''
    vi.stubEnv('VITE_USDA_API_KEY', 'build-key');
    expect(resolveUsdaKey(null)).toEqual({ key: 'build-key', source: 'build' });
    expect(resolveUsdaKey('')).toEqual({ key: 'build-key', source: 'build' });
    vi.unstubAllEnvs();
  });
});
