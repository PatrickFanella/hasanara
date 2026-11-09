import type { SavedSearchFilters } from '../../types/api';

/** Resolve at open time so a rolling saved search never freezes on its creation date. */
export function resolveDateRange(
  filters: SavedSearchFilters,
  now = new Date()
): SavedSearchFilters {
  const days =
    filters.date_range === 'past_7_days' ? 7 : filters.date_range === 'past_30_days' ? 30 : null;
  if (!days) return filters;
  const end = new Date(now);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return {
    ...filters,
    date_from: start.toISOString().slice(0, 10),
    date_to: end.toISOString().slice(0, 10),
  };
}
