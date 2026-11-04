import { describe, expect, it } from 'vitest';
import {
  buildTimestampLink,
  formatAggregateDuration,
  formatCount,
  formatVideoTitle,
} from '../features/archive/format';

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
