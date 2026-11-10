import { describe, expect, it } from 'vitest';
import {
  buildTimestampLink,
  durationParts,
  formatAggregateDuration,
  formatCount,
  formatCoverage,
  formatDate,
  formatVideoTitle,
  videoDate,
} from '../features/archive/format';

describe('durationParts', () => {
  const text = (seconds: number) =>
    durationParts(seconds)
      .map((part) => `${part.value}${part.unit}`)
      .join(' ');

  it('breaks long runtimes into days, hours and minutes', () => {
    expect(text(61047924)).toBe('706d 13h 45m');
  });

  it('drops leading zero units but keeps interior ones', () => {
    expect(text(7260)).toBe('2h 1m');
    expect(text(86400)).toBe('1d 0h 0m');
    expect(text(30)).toBe('0m');
  });

  it('returns nothing for a missing runtime', () => {
    expect(durationParts(null)).toEqual([]);
  });
});

describe('archive moment links', () => {
  it('uses the exact start time as a source-neutral canonical anchor', () => {
    expect(buildTimestampLink('video-1', 5_956_000, 'whisper')).toBe(
      '/v/video-1?t=5956#moment-5956000'
    );
  });

  it('preserves exact milliseconds for moments that begin after a transcript gap', () => {
    expect(buildTimestampLink('video-1', 16_518_140, 'whisper')).toBe(
      '/v/video-1?t=16518&t_ms=16518140#moment-16518140'
    );
    expect(buildTimestampLink('video-1', 16_518_140)).toBe(
      '/v/video-1?t=16518&t_ms=16518140#moment-16518140'
    );
  });

  it('uses an intentional date treatment for missing or dangling titles', () => {
    expect(formatVideoTitle('HasanAbi broadcast —', '2026-08-07T00:00:00Z')).toBe(
      'HasanAbi broadcast'
    );
    expect(formatVideoTitle('', '2026-08-07T00:00:00Z')).toMatch(/^Broadcast from /);
    expect(formatVideoTitle('HasanAbi July 10, 2026 –', null)).toBe('HasanAbi July 10, 2026');
  });

  it('formats archive-scale runtime for humans', () => {
    expect(formatAggregateDuration(16_378.6 * 3600)).toMatch(/^16\.4k hours$/);
  });
});

describe('archive count labels', () => {
  it('agrees the noun with the count and keeps number formatting', () => {
    expect(formatCount(1, 'VOD')).toBe('1 VOD');
    expect(formatCount(2, 'VOD')).toBe('2 VODs');
    expect(formatCount(0, 'moment')).toBe('0 moments');
    expect(formatCount(1250, 'cited moment')).toBe('1,250 cited moments');
    expect(formatCount(undefined, 'mention')).toBe('0 mentions');
  });
});

describe('broadcast dates and coverage', () => {
  it('shows calendar dates as the same day in every time zone', () => {
    // Midnight UTC rendered in a US time zone used to show the previous day.
    const expected = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2024, 10, 25)));
    expect(formatDate('2024-11-25')).toBe(expected);
    expect(formatDate('2024-11-25T00:00:00+00:00')).toBe(expected);
  });

  it('prefers the broadcast date over the upload date', () => {
    expect(videoDate({ broadcast_date: '2024-11-25', uploaded_at: '2024-11-27T00:00:00Z' })).toBe(
      '2024-11-25'
    );
    expect(videoDate({ uploaded_at: '2024-11-27T00:00:00Z' })).toBe('2024-11-27T00:00:00Z');
    expect(videoDate(null)).toBeNull();
  });

  it('summarises day coverage', () => {
    expect(formatCoverage({ days: 30, vod_days: 26, no_stream_days: 2, unknown_days: 2 })).toBe(
      '26 of 30 days archived · 2 no-stream days · 2 unknown'
    );
    expect(formatCoverage({ days: 7, vod_days: 6, no_stream_days: 1, unknown_days: 0 })).toBe(
      '6 of 7 days archived · 1 no-stream day'
    );
    expect(formatCoverage(null)).toBeNull();
  });
});
