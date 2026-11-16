import { describe, expect, it } from 'vitest';
import { createConfirmer } from '../../../src/scanner/confirm';

describe('createConfirmer', () => {
  it('accepts a code seen twice in a row', () => {
    const c = createConfirmer();
    expect(c.push('0123456789012')).toBeNull();
    expect(c.push('0123456789012')).toBe('0123456789012');
  });
  it('does not accept differing consecutive codes', () => {
    const c = createConfirmer();
    expect(c.push('111')).toBeNull();
    expect(c.push('222')).toBeNull();
    expect(c.push('222')).toBe('222');
  });
  it('resets on a miss', () => {
    const c = createConfirmer();
    c.push('111');
    expect(c.push(null)).toBeNull();
    expect(c.push('111')).toBeNull();
  });
  it('restarts after accepting and after reset()', () => {
    const c = createConfirmer();
    c.push('1');
    expect(c.push('1')).toBe('1');
    expect(c.push('1')).toBeNull();
    c.reset();
    expect(c.push('1')).toBeNull();
  });
  it('supports a custom threshold', () => {
    const c = createConfirmer(3);
    c.push('9');
    expect(c.push('9')).toBeNull();
    expect(c.push('9')).toBe('9');
  });
});
