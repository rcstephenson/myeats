import { describe, expect, it } from 'vitest';
import { expandUpcE, isValidGtin, normaliseBarcode } from '../../../src/domain/barcode';

describe('isValidGtin', () => {
  it('accepts valid EAN-13, UPC-A and EAN-8', () => {
    expect(isValidGtin('3017620422003')).toBe(true);
    expect(isValidGtin('016459200441')).toBe(true);
    expect(isValidGtin('96385074')).toBe(true);
  });
  it('rejects bad check digits, bad lengths and non-digits', () => {
    expect(isValidGtin('3017620422004')).toBe(false);
    expect(isValidGtin('12345')).toBe(false);
    expect(isValidGtin('30176204220a3')).toBe(false);
    expect(isValidGtin('')).toBe(false);
  });
});

describe('expandUpcE', () => {
  it('expands a known example', () => {
    expect(expandUpcE('04252614')).toBe('042100005264');
  });
  it('covers each last-digit branch', () => {
    expect(expandUpcE('01234509')).toBe('012000003459'); // last 0
    expect(expandUpcE('01234529')).toBe('012200003459'); // last 2
    expect(expandUpcE('01234539')).toBe('012300000459'); // last 3
    expect(expandUpcE('01234549')).toBe('012340000059'); // last 4
    expect(expandUpcE('01234559')).toBe('012345000059'); // last 5
    expect(expandUpcE('01234599')).toBe('012345000099'); // last 9
  });
  it('returns null for non UPC-E input', () => {
    expect(expandUpcE('21234565')).toBeNull();
    expect(expandUpcE('0123456')).toBeNull();
  });
});

describe('normaliseBarcode', () => {
  it('pads UPC-A to GTIN-13', () => {
    expect(normaliseBarcode('016459200441')).toBe('0016459200441');
  });
  it('keeps EAN-13', () => {
    expect(normaliseBarcode('3017620422003')).toBe('3017620422003');
  });
  it('pads EAN-8 to 13 digits', () => {
    expect(normaliseBarcode('96385074')).toBe('0000096385074');
  });
  it('expands UPC-E then pads', () => {
    expect(normaliseBarcode('04252614')).toBe('0042100005264');
  });
  it('strips non-digits', () => {
    expect(normaliseBarcode(' 0 16459-200441 ')).toBe('0016459200441');
    expect(normaliseBarcode('3017 6204 22003')).toBe('3017620422003');
  });
  it('returns null for bad check digits or lengths', () => {
    expect(normaliseBarcode('016459200442')).toBeNull();
    expect(normaliseBarcode('3017620422004')).toBeNull();
    expect(normaliseBarcode('96385075')).toBeNull();
    expect(normaliseBarcode('12345')).toBeNull();
    expect(normaliseBarcode('abc')).toBeNull();
    expect(normaliseBarcode('')).toBeNull();
    expect(normaliseBarcode('30176204220030')).toBeNull();
  });
});
