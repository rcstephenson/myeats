/**
 * "Seen twice in a row" filter for decode results. Feed it each decode attempt's code (or null for
 * no result); it returns the code once it has been seen `needed` consecutive times, else null.
 */
export interface Confirmer {
  push(code: string | null): string | null;
  reset(): void;
}

export function createConfirmer(needed = 2): Confirmer {
  let last: string | null = null;
  let count = 0;
  return {
    push(code) {
      if (code === null) {
        last = null;
        count = 0;
        return null;
      }
      if (code === last) count += 1;
      else {
        last = code;
        count = 1;
      }
      if (count >= needed) {
        last = null;
        count = 0;
        return code;
      }
      return null;
    },
    reset() {
      last = null;
      count = 0;
    },
  };
}
