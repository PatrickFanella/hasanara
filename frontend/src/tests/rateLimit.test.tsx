import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RateLimitNotice from '../components/RateLimitNotice';
import {
  DEFAULT_RETRY_AFTER_SECONDS,
  clearRateLimit,
  getRateLimit,
  noteRateLimited,
  recordRateLimitedResponse,
  retryAfterSeconds,
} from '../services/rateLimit';

describe('rate limit state', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T12:00:00Z'));
    clearRateLimit();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads a numeric or HTTP-date Retry-After header and falls back to a default', () => {
    expect(retryAfterSeconds(new Response(null, { headers: { 'Retry-After': '42' } }))).toBe(42);
    expect(
      retryAfterSeconds(
        new Response(null, { headers: { 'Retry-After': 'Wed, 04 Nov 2026 12:00:30 GMT' } })
      )
    ).toBe(30);
    expect(retryAfterSeconds(new Response(null))).toBe(DEFAULT_RETRY_AFTER_SECONDS);
  });

  it('records only 429 responses and expires with the window', () => {
    recordRateLimitedResponse(new Response(null, { status: 200 }));
    expect(getRateLimit()).toBeNull();

    recordRateLimitedResponse(
      new Response(null, { status: 429, headers: { 'Retry-After': '10' } })
    );
    expect(getRateLimit()).toEqual({ until: Date.now() + 10_000 });

    vi.advanceTimersByTime(10_001);
    expect(getRateLimit()).toBeNull();
  });

  it('keeps the later of two overlapping windows', () => {
    noteRateLimited(30);
    noteRateLimited(5);
    expect(getRateLimit()).toEqual({ until: Date.now() + 30_000 });
  });

  it('shows a counting-down notice while limited and nothing afterwards', () => {
    render(<RateLimitNotice />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => noteRateLimited(3));
    expect(screen.getByRole('status')).toHaveTextContent('Requests resume in 3 seconds');

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Requests resume in 1 second');

    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
