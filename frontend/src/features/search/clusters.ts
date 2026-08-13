import type { SearchHit } from '../../types/api';

export const NEARBY_MATCH_WINDOW_MS = 10_000;

/** Keep raw moments intact while presenting nearby transcript hits as one cluster. */
export function clusterNearbyMoments<T extends SearchHit>(moments: T[]): T[][] {
  return moments.reduce<T[][]>((clusters, moment) => {
    const current = clusters.at(-1);
    const previous = current?.at(-1);
    if (current && previous && moment.start_ms - previous.start_ms <= NEARBY_MATCH_WINDOW_MS) {
      current.push(moment);
    } else {
      clusters.push([moment]);
    }
    return clusters;
  }, []);
}
