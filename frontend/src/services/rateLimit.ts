// Shared state for API rate limiting so the shell can tell the visitor what is
// happening instead of leaving a page silently blank while the client waits.

export type RateLimitState = { until: number } | null;

const listeners = new Set<() => void>();
let state: RateLimitState = null;

export const DEFAULT_RETRY_AFTER_SECONDS = 30;
// Beyond this the client gives up retrying on its own and surfaces the state.
export const MAX_AUTOMATIC_RETRY_AFTER_MS = 5_000;

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeRateLimit(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRateLimit(): RateLimitState {
  if (state && state.until <= Date.now()) {
    state = null;
  }
  return state;
}

export function noteRateLimited(retryAfterSeconds: number, now = Date.now()) {
  const seconds =
    Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds
      : DEFAULT_RETRY_AFTER_SECONDS;
  const until = now + Math.ceil(seconds) * 1000;
  if (!state || until > state.until) {
    state = { until };
    emit();
  }
}

export function clearRateLimit() {
  if (state) {
    state = null;
    emit();
  }
}

export function retryAfterSeconds(response: Response, now = Date.now()): number {
  const header = response.headers.get('Retry-After');
  if (!header) return DEFAULT_RETRY_AFTER_SECONDS;
  const numeric = Number(header);
  if (Number.isFinite(numeric)) return numeric;
  const date = Date.parse(header);
  if (Number.isNaN(date)) return DEFAULT_RETRY_AFTER_SECONDS;
  return Math.max(0, (date - now) / 1000);
}

export function recordRateLimitedResponse(response: Response) {
  if (response.status === 429) noteRateLimited(retryAfterSeconds(response));
  return response;
}
