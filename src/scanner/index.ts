import { lazy } from 'react';

export const ScannerView = lazy(() => import('./ScannerView'));

let prefetched = false;

/** Warm the scanner chunk when the browser is idle. Safe to call repeatedly. */
export function prefetchScanner(): void {
  if (prefetched) return;
  prefetched = true;
  const load = () => {
    void import('./ScannerView').catch(() => {
      prefetched = false;
    });
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(load);
  else setTimeout(load, 2000);
}

export type { ScannerViewProps } from './ScannerView';
