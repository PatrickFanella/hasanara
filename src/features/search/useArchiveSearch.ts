import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, track } from '../../services';
import type {
  ArchiveSearchFilters,
  EpisodeSearchGroup,
  GroupedSearchResponse,
} from '../../types/api';
import type { SearchFilters } from './filters';

const SEARCH_PAGE_SIZE = 20;

function mergeGroups(pages: GroupedSearchResponse[]): GroupedSearchResponse | null {
  if (!pages.length) return null;
  const byVideo = new Map<string, EpisodeSearchGroup>();
  for (const page of pages) {
    for (const group of page.groups) {
      const existing = byVideo.get(group.video.id);
      if (existing) existing.moments.push(...group.moments);
      else byVideo.set(group.video.id, { ...group, moments: [...group.moments] });
    }
  }
  const latest = pages.at(-1)!;
  return {
    ...latest,
    groups: [...byVideo.values()],
    total_moments: [...byVideo.values()].reduce((total, group) => total + group.moments.length, 0),
    total_videos: byVideo.size,
  };
}

export function useArchiveSearch(filters: SearchFilters) {
  const shouldFetch = Boolean(filters.q.trim());
  const activeFilters: ArchiveSearchFilters = useMemo(
    () => ({
      match_mode: filters.match_mode ?? 'topic',
      date_from: filters.date_from,
      date_to: filters.date_to,
      sort_by: filters.sort_by,
      video_id: filters.video_id,
      limit: SEARCH_PAGE_SIZE,
    }),
    [filters]
  );
  const suggestions = useQuery({
    queryKey: ['search-suggestions', 'a', 10],
    queryFn: ({ signal }) => api.getSearchSuggestions('a', 10, signal),
  });
  const search = useInfiniteQuery({
    queryKey: ['search', filters.q.trim(), activeFilters],
    enabled: shouldFetch,
    retry: false,
    initialPageParam: 0,
    queryFn: ({ signal, pageParam }) =>
      api.searchGrouped(filters.q.trim(), { ...activeFilters, offset: pageParam }, signal),
    getNextPageParam: (lastPage) =>
      lastPage.page_info?.has_next_page ? (lastPage.page_info.next_offset ?? undefined) : undefined,
  });

  useEffect(() => {
    if (shouldFetch) track({ type: 'search', payload: { ...activeFilters } });
  }, [activeFilters, shouldFetch]);

  const grouped = useMemo(() => mergeGroups(search.data?.pages ?? []), [search.data?.pages]);
  return {
    shouldFetch,
    suggestedSearches: suggestions.data?.suggestions ?? [],
    grouped,
    // A later page must not replace already-visible results with the initial
    // loading state. `loadingMore` owns that narrower pending state.
    loading: shouldFetch && search.isPending,
    loadingMore: search.isFetchingNextPage,
    canLoadMore: Boolean(search.hasNextPage),
    loadMore: search.fetchNextPage,
    queryError: search.isError ? 'Search failed. Try again.' : null,
  };
}
