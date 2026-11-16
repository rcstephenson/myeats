import { useEffect, useState } from 'react';
import * as searchCache from '../../db/repositories/searchCache';
import type { RemoteFood } from '../../domain/types';
import { OfflineError, RateLimitError } from '../../sources/errors';
import { normaliseQuery, searchUsda } from '../../sources/usda';

export const DEBOUNCE_MS = 250;
/** Cached results older than this are refreshed in the background (SPEC 6.2). */
export const STALE_MS = 7 * 24 * 60 * 60 * 1000;

export type UsdaStatus = 'idle' | 'loading' | 'done' | 'offline' | 'busy' | 'error';

export type UsdaState = { status: UsdaStatus; results: RemoteFood[]; cached: boolean };

const IDLE: UsdaState = { status: 'idle', results: [], cached: false };

export function isFresh(fetchedAt: string, now: number): boolean {
  const t = Date.parse(fetchedAt);
  return !Number.isNaN(t) && now - t < STALE_MS;
}

/**
 * USDA search for the Add overlay: cached results show immediately, the request starts after a
 * 250 ms debounce, and an AbortController cancels stale requests. A fresh cache hit makes no
 * request at all.
 */
export function useUsdaSearch(query: string, apiKey: string): UsdaState {
  const [state, setState] = useState<UsdaState>(IDLE);
  const nq = normaliseQuery(query);

  useEffect(() => {
    if (nq.length < 2) {
      setState(IDLE);
      return;
    }
    let cancelled = false;
    let timer: number | undefined;
    const ac = new AbortController();
    const key = `usda:${nq}`;

    void (async () => {
      let row: Awaited<ReturnType<typeof searchCache.get>>;
      try {
        row = await searchCache.get(key);
      } catch {
        row = undefined;
      }
      if (cancelled) return;
      const fresh = row !== undefined && isFresh(row.fetchedAt, Date.now());
      if (row) setState({ status: fresh ? 'done' : 'loading', results: row.results, cached: true });
      else setState({ status: 'loading', results: [], cached: false });
      if (fresh) return;

      timer = window.setTimeout(() => {
        void (async () => {
          try {
            const results = await searchUsda(nq, { signal: ac.signal, apiKey });
            if (cancelled) return;
            setState({ status: 'done', results, cached: false });
            try {
              await searchCache.put(key, results);
            } catch {
              // Cache failures never break search.
            }
          } catch (e) {
            if (cancelled || ac.signal.aborted) return;
            const status: UsdaStatus =
              e instanceof OfflineError ? 'offline' : e instanceof RateLimitError ? 'busy' : 'error';
            // Keep any cached results visible next to the note.
            setState((s) => ({ ...s, status }));
          }
        })();
      }, DEBOUNCE_MS);
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [nq, apiKey]);

  return state;
}
