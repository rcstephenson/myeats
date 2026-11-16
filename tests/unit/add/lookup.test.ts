import { describe, expect, it, vi } from 'vitest';
import { lookupBarcode, type LookupDeps } from '../../../src/components/add/lookup';
import type { RemoteFood } from '../../../src/domain/types';
import { OfflineError, SourceError } from '../../../src/sources/errors';
import { food } from '../domain/factories';

const remote = { name: 'Remote' } as RemoteFood;

function deps(p: Partial<LookupDeps> = {}): LookupDeps {
  return {
    byBarcode: vi.fn().mockResolvedValue(undefined),
    off: vi.fn().mockResolvedValue(null),
    usda: vi.fn().mockResolvedValue(null),
    apiKey: 'k',
    ...p,
  };
}

const CODE = '5449000000996';

describe('lookupBarcode', () => {
  it('local foods win and stop the chain', async () => {
    const d = deps({ byBarcode: vi.fn().mockResolvedValue(food()) });
    expect((await lookupBarcode(CODE, d)).kind).toBe('local');
    expect(d.off).not.toHaveBeenCalled();
  });

  it('falls through Open Food Facts to USDA', async () => {
    const d = deps({ usda: vi.fn().mockResolvedValue(remote) });
    expect(await lookupBarcode(CODE, d)).toEqual({ kind: 'remote', remote });
    expect(d.off).toHaveBeenCalledWith(CODE, expect.anything());
  });

  it('looks up the normalised GTIN locally', async () => {
    const d = deps();
    await lookupBarcode('036000291452', d);
    expect(d.byBarcode).toHaveBeenCalledWith('0036000291452');
  });

  it('nothing found is "none"; an invalid code is "none" without any request', async () => {
    expect(await lookupBarcode(CODE, deps())).toEqual({ kind: 'none' });
    const d = deps();
    expect(await lookupBarcode('123', d)).toEqual({ kind: 'none' });
    expect(d.off).not.toHaveBeenCalled();
  });

  it('a failing source still lets the next one answer', async () => {
    const d = deps({
      off: vi.fn().mockRejectedValue(new SourceError('boom')),
      usda: vi.fn().mockResolvedValue(remote),
    });
    expect((await lookupBarcode(CODE, d)).kind).toBe('remote');
  });

  it('no match plus a failure is an error, flagged offline when it was', async () => {
    const off = vi.fn().mockRejectedValue(new OfflineError());
    const usda = vi.fn().mockRejectedValue(new OfflineError());
    expect(await lookupBarcode(CODE, deps({ off, usda }))).toEqual({ kind: 'error', offline: true });
    const other = vi.fn().mockRejectedValue(new SourceError('x'));
    expect(await lookupBarcode(CODE, deps({ off: other }))).toEqual({ kind: 'error', offline: false });
  });

  it('propagates aborts', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    await expect(lookupBarcode(CODE, deps({ off: vi.fn().mockRejectedValue(abort) }))).rejects.toThrow('aborted');
  });
});
