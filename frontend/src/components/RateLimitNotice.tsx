import { useEffect, useState, useSyncExternalStore } from 'react';
import { getRateLimit, subscribeRateLimit } from '../services/rateLimit';

export default function RateLimitNotice() {
  const limit = useSyncExternalStore(subscribeRateLimit, getRateLimit, () => null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!limit) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [limit]);

  const seconds = limit ? Math.max(0, Math.ceil((limit.until - now) / 1000)) : 0;
  if (!limit || seconds <= 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="alert-warning mx-auto mt-4 w-full max-w-[100rem] px-4 text-sm lg:px-6"
      data-testid="rate-limit-notice"
    >
      The archive is busy and asked this browser to slow down. Requests resume in {seconds}{' '}
      {seconds === 1 ? 'second' : 'seconds'}; anything that failed to load can be retried then.
    </div>
  );
}
