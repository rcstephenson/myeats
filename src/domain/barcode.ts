// Barcode normalisation (SPEC §6.3). Pure functions, no I/O.
//
// Storage format is always GTIN-13: UPC-A (12) gets one leading zero, UPC-E (8, starts 0/1) is
// expanded to UPC-A first, and EAN-8 is left-padded with five zeros. Padding with leading zeros
// preserves the check digit, so every stored code is a valid GTIN-13. Padding EAN-8 (rather than
// storing it as 8 digits) means one lookup key per product regardless of scanner symbology.

const digitsOnly = (s: string): string => s.replace(/\D/g, '');

/** True when `code` is all digits (8, 12, 13 or 14 long) and its GS1 check digit is correct. */
export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code)) return false;
  if (![8, 12, 13, 14].includes(code.length)) return false;
  let sum = 0;
  // Weights 3,1,3,1... counting from the digit left of the check digit, moving left.
  for (let i = code.length - 2, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += Number(code[i]) * w;
  }
  return (10 - (sum % 10)) % 10 === Number(code[code.length - 1]);
}

/** Expand an 8-digit UPC-E (number system 0 or 1) to its 12-digit UPC-A. null if not UPC-E shaped. */
export function expandUpcE(upcE: string): string | null {
  if (!/^[01]\d{7}$/.test(upcE)) return null;
  const [ns, a, b, c, d, e, last, check] = upcE.split('');
  let body: string;
  if (last === '0' || last === '1' || last === '2') body = `${ns}${a}${b}${last}0000${c}${d}${e}`;
  else if (last === '3') body = `${ns}${a}${b}${c}00000${d}${e}`;
  else if (last === '4') body = `${ns}${a}${b}${c}${d}00000${e}`;
  else body = `${ns}${a}${b}${c}${d}${e}0000${last}`;
  return body + check;
}

/**
 * Normalise a scanned/typed barcode to a valid GTIN-13 string, or null if it isn't one.
 * 8-digit codes starting 0/1 are tried as UPC-E first (SPEC), then as EAN-8.
 */
export function normaliseBarcode(input: string): string | null {
  const code = digitsOnly(input);
  if (code.length === 8) {
    if (/^[01]/.test(code)) {
      const upcA = expandUpcE(code);
      if (upcA && isValidGtin(upcA)) return `0${upcA}`;
    }
    return isValidGtin(code) ? `00000${code}` : null;
  }
  if (code.length === 12) return isValidGtin(code) ? `0${code}` : null;
  if (code.length === 13) return isValidGtin(code) ? code : null;
  return null;
}
