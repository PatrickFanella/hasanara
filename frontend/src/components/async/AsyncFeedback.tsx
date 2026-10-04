import type { ReactNode } from 'react';

export function AsyncStatus({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="text-sm text-muted">
      {children}
    </div>
  );
}

export function AsyncError({
  children,
  onRetry,
  retryLabel = 'Retry',
}: {
  children: ReactNode;
  onRetry: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="alert-warning flex flex-wrap items-center justify-between gap-3" role="alert">
      <span>{children}</span>
      <button type="button" className="btn-secondary min-h-10 px-3 text-sm" onClick={onRetry}>
        {retryLabel}
      </button>
    </div>
  );
}
