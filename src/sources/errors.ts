// Typed errors for network sources, plus the one shared fetch helper. AbortError is never wrapped:
// it propagates as-is so callers can ignore cancelled requests.

export class SourceError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'SourceError';
    this.status = status;
  }
}

/** Device offline or the request could not reach the server (fetch TypeError). */
export class OfflineError extends SourceError {
  constructor(message = 'You are offline') {
    super(message);
    this.name = 'OfflineError';
  }
}

/** HTTP 429. Callers show a "busy" message; nothing retries automatically. */
export class RateLimitError extends SourceError {
  constructor(message = 'Rate limited') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

/** HTTP 404 (or an explicit not-found payload). */
export class NotFoundError extends SourceError {
  constructor(message = 'Not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export function isAbortError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError';
}

/** fetch + JSON with the error mapping above. Single attempt, never retries. */
export async function fetchJson(url: string, init: RequestInit = {}): Promise<unknown> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new OfflineError();
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if (isAbortError(e)) throw e;
    if (e instanceof TypeError) throw new OfflineError();
    throw new SourceError(e instanceof Error ? e.message : 'Network error');
  }
  if (res.status === 429) throw new RateLimitError();
  if (res.status === 404) throw new NotFoundError();
  if (!res.ok) throw new SourceError(`HTTP ${res.status}`, res.status);
  try {
    return await res.json();
  } catch (e) {
    if (isAbortError(e)) throw e;
    throw new SourceError('Invalid response');
  }
}
