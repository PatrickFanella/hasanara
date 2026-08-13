import { describe, expect, it } from 'vitest';
import { clusterNearbyMoments } from './clusters';

const moment = (id: number, start_ms: number) => ({
  id,
  video_id: 'video-1',
  start_ms,
  end_ms: start_ms + 500,
  snippet: `match ${id}`,
});

describe('clusterNearbyMoments', () => {
  it('groups raw moments that begin within ten seconds of the preceding match', () => {
    expect(clusterNearbyMoments([moment(1, 0), moment(2, 9_999), moment(3, 20_000)])).toEqual([
      [moment(1, 0), moment(2, 9_999)],
      [moment(3, 20_000)],
    ]);
  });
});
