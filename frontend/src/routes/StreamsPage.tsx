import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { StreamCard } from '../components/archive';
import { buildTimestampLink, formatTimestamp } from '../features/archive/format';
import { DEFAULT_LIMIT } from '../features/streams/library';
import { api } from '../services';
import type { MomentDiscoveryItem, PageInfo, TopicDiscoveryItem, VideoInfo } from '../types/api';

type FeedTab = 'latest' | 'topics' | 'moments';
type FeedItem = VideoInfo | TopicDiscoveryItem | MomentDiscoveryItem;
type FeedState = {
  items: FeedItem[];
  page: PageInfo | null;
  loading: boolean;
  error: string | null;
};

const emptyFeed = (): FeedState => ({ items: [], page: null, loading: false, error: null });

function uniqueItems(previous: FeedItem[], incoming: FeedItem[]) {
  const key = (item: FeedItem) => {
    if ('kind' in item && item.kind === 'topic') return `topic:${item.topic.slug}`;
    if ('kind' in item && item.kind === 'moment')
      return `moment:${item.video.id}:${item.start_ms}:${item.end_ms}`;
    return `video:${(item as VideoInfo).id}`;
  };
  const seen = new Set(previous.map(key));
  return [...previous, ...incoming.filter((item) => !seen.has(key(item)))];
}

export default function StreamsPage() {
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab');
  const tab: FeedTab =
    requestedTab === 'topics' || requestedTab === 'moments' ? requestedTab : 'latest';
  const q = params.get('q') ?? '';
  const sort =
    params.get('sort') === 'longest' || params.get('sort') === 'relevance'
      ? params.get('sort')!
      : 'latest';
  const [searchDraft, setSearchDraft] = useState(q);
  const [feeds, setFeeds] = useState<Record<FeedTab, FeedState>>({
    latest: emptyFeed(),
    topics: emptyFeed(),
    moments: emptyFeed(),
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const filterButton = useRef<HTMLButtonElement>(null);
  const filterSheet = useRef<HTMLElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const tabScrollPositions = useRef<Record<FeedTab, number>>({ latest: 0, topics: 0, moments: 0 });
  const loadedVersion = useRef<Record<FeedTab, number>>({ latest: -1, topics: -1, moments: -1 });
  const active = feeds[tab];

  const filters = useMemo(
    () => ({
      date_from: params.get('date_from') ?? '',
      date_to: params.get('date_to') ?? '',
      min_duration: params.get('min_duration') ?? '',
      max_duration: params.get('max_duration') ?? '',
      transcript_source: params.get('transcript_source') ?? 'any',
    }),
    [params]
  );

  useEffect(() => setSearchDraft(q), [q]);
  useEffect(() => {
    window.requestAnimationFrame(() => window.scrollTo({ top: tabScrollPositions.current[tab] }));
  }, [tab]);
  useEffect(() => {
    if (!filterOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFilterOpen(false);
        filterButton.current?.focus();
      }
      if (event.key === 'Tab') {
        const controls = [
          ...(filterSheet.current?.querySelectorAll<HTMLElement>(
            'button, input, select, [href], [tabindex]:not([tabindex="-1"])'
          ) ?? []),
        ].filter((item) => !item.hasAttribute('disabled'));
        const first = controls[0];
        const last = controls.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    filterSheet.current?.querySelector<HTMLElement>('button, input, select')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [filterOpen]);

  const load = useCallback(
    async (target: FeedTab, append: boolean, signal?: AbortSignal) => {
      const current = feeds[target];
      if (current.loading || (append && !current.page?.has_next_page)) return;
      setFeeds((all) => ({
        ...all,
        [target]: { ...all[target], loading: true, error: null },
      }));
      try {
        const response =
          target === 'latest'
            ? await api.listStreamLibrary(
                {
                  limit: DEFAULT_LIMIT,
                  cursor: append ? (current.page?.next_cursor ?? undefined) : undefined,
                  sort: sort as 'latest' | 'relevance' | 'longest',
                  q: q || undefined,
                  date_field: 'uploaded_at',
                  date_from: filters.date_from || undefined,
                  date_to: filters.date_to || undefined,
                  min_duration: filters.min_duration ? Number(filters.min_duration) : undefined,
                  max_duration: filters.max_duration ? Number(filters.max_duration) : undefined,
                  transcript_source: filters.transcript_source as
                    | 'any'
                    | 'whisper'
                    | 'youtube'
                    | 'both',
                },
                signal
              )
            : await api.listDiscovery(
                target,
                DEFAULT_LIMIT,
                append ? (current.page?.next_cursor ?? undefined) : undefined,
                signal
              );
        setFeeds((all) => ({
          ...all,
          [target]: {
            items: append ? uniqueItems(all[target].items, response.items) : response.items,
            page: response.page_info,
            loading: false,
            error: null,
          },
        }));
      } catch (error) {
        if (signal?.aborted) return;
        console.error('Failed to load discovery feed', error);
        setFeeds((all) => ({
          ...all,
          [target]: { ...all[target], loading: false, error: 'This feed could not refresh.' },
        }));
      }
    },
    [feeds, filters, q, sort]
  );

  useEffect(() => {
    const version = tab === 'latest' ? requestVersion : 0;
    if (loadedVersion.current[tab] === version && feeds[tab].page) return;
    loadedVersion.current[tab] = version;
    const controller = new AbortController();
    void load(tab, false, controller.signal);
    return () => controller.abort();
    // A new query/filter version deliberately resets only the active tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, requestVersion]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !active.page?.has_next_page || active.loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void load(tab, true);
      },
      { rootMargin: '0px 0px 580px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [active.loading, active.page?.has_next_page, load, tab]);

  function setTab(next: FeedTab) {
    tabScrollPositions.current[tab] = window.scrollY;
    const nextParams = new URLSearchParams(params);
    if (next === 'latest') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params);
    const normalized = searchDraft.trim();
    if (normalized) next.set('q', normalized);
    else next.delete('q');
    if (next.get('sort') === 'relevance' && !normalized) next.delete('sort');
    setParams(next);
    setRequestVersion((value) => value + 1);
  }

  function updateFilter(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value && value !== 'any') next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  }

  function applyFilters() {
    setFilterOpen(false);
    setRequestVersion((value) => value + 1);
    filterButton.current?.focus();
  }

  const applied = Object.entries(filters).filter(([, value]) => value && value !== 'any');

  return (
    <div className="feed-shell">
      <header className="feed-header">
        <div className="feed-heading-row">
          <div>
            <p className="archive-eyebrow">Public archive</p>
            <h1 tabIndex={-1} className="text-2xl font-semibold tracking-[-0.04em] text-ink">
              Watch the archive
            </h1>
          </div>
          <p className="feed-count">
            {active.page?.total_count == null
              ? 'Citation-backed discovery'
              : `${active.page.total_count.toLocaleString()} ${tab === 'latest' ? 'library records' : tab}`}
          </p>
        </div>

        <div className="feed-tabs" role="tablist" aria-label="Archive feeds">
          {(['latest', 'topics', 'moments'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'latest' && (
          <form className="feed-tools" role="search" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="feed-search">
              Search VODs
            </label>
            <input
              id="feed-search"
              className="form-control"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search VODs"
            />
            <select
              aria-label="Sort VODs"
              className="form-control feed-sort"
              value={sort}
              onChange={(event) => {
                updateFilter('sort', event.target.value);
                setRequestVersion((value) => value + 1);
              }}
            >
              <option value="latest">Latest</option>
              <option value="relevance" disabled={!q}>
                Relevance
              </option>
              <option value="longest">Longest</option>
            </select>
            <button
              ref={filterButton}
              type="button"
              className="btn-secondary"
              onClick={() => setFilterOpen(true)}
            >
              Filters{applied.length ? ` (${applied.length})` : ''}
            </button>
            <button type="submit" className="btn-primary">
              Search
            </button>
          </form>
        )}

        {applied.length > 0 && tab === 'latest' && (
          <div className="feed-chips" aria-label="Applied filters">
            {applied.map(([name, value]) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  updateFilter(name, '');
                  setRequestVersion((v) => v + 1);
                }}
              >
                {name.replaceAll('_', ' ')}: {value} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {active.loading && active.items.length === 0 ? (
        <section aria-label="Loading feed" className="feed-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="feed-card feed-skeleton animate-pulse" />
          ))}
        </section>
      ) : active.error && active.items.length === 0 ? (
        <div className="surface-card text-center" role="alert">
          <h2 className="section-title">VOD library unavailable</h2>
          <p className="mt-2 text-muted">The last request failed. Your filters are still here.</p>
          <button type="button" className="btn-primary mt-4" onClick={() => void load(tab, false)}>
            Retry
          </button>
        </div>
      ) : active.items.length === 0 ? (
        <div className="surface-card text-center">
          <h2 className="section-title">No VODs match these filters.</h2>
          <p className="mt-2 text-muted">Try broadening the date range or removing a filter.</p>
        </div>
      ) : (
        <section aria-label={`${tab} feed`} className="feed-grid">
          {active.items.map((item) => {
            if ('kind' in item && item.kind === 'topic') {
              return (
                <Link
                  className="discovery-card"
                  key={item.topic.slug}
                  to={`/topics/${encodeURIComponent(item.topic.slug)}`}
                >
                  <span className="archive-eyebrow">Topic</span>
                  <h2>{item.topic.label}</h2>
                  <p>
                    {item.topic.total_videos} VODs · {item.topic.total_moments} cited moments
                  </p>
                  <span className="action-link">Explore evidence →</span>
                </Link>
              );
            }
            if ('kind' in item && item.kind === 'moment') {
              return (
                <Link
                  className="discovery-card moment-card"
                  key={`${item.video.id}:${item.start_ms}`}
                  to={buildTimestampLink(item.video.id, item.start_ms)}
                >
                  <span className="timestamp-pill">{formatTimestamp(item.start_ms)}</span>
                  <blockquote>“{item.snippet}”</blockquote>
                  <p>
                    {item.video.title} {item.topic ? `· ${item.topic}` : ''}
                  </p>
                  <span className="action-link">Play cited moment →</span>
                </Link>
              );
            }
            return (
              <StreamCard
                key={(item as VideoInfo).id}
                video={item as VideoInfo}
                dateField="uploaded_at"
              />
            );
          })}
        </section>
      )}

      <div ref={sentinel} className="feed-load-more">
        {active.error && active.items.length > 0 && (
          <p role="alert">Couldn’t load the next page. Existing results are preserved.</p>
        )}
        {active.page?.has_next_page && (
          <button
            type="button"
            className="btn-secondary"
            disabled={active.loading}
            onClick={() => void load(tab, true)}
          >
            {active.loading ? 'Loading…' : active.error ? 'Retry' : 'Load more'}
          </button>
        )}
      </div>

      {filterOpen && (
        <div
          className="sheet-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFilterOpen(false);
          }}
        >
          <section
            ref={filterSheet}
            className="filter-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feed-filter-title"
          >
            <div className="sheet-handle" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <h2 id="feed-filter-title" className="section-title">
                Filter the archive
              </h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Close filters"
                onClick={() => {
                  setFilterOpen(false);
                  filterButton.current?.focus();
                }}
              >
                ×
              </button>
            </div>
            <div className="filter-sheet-grid">
              <label>
                From
                <input
                  type="date"
                  className="form-control"
                  value={filters.date_from}
                  onChange={(e) => updateFilter('date_from', e.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  className="form-control"
                  value={filters.date_to}
                  onChange={(e) => updateFilter('date_to', e.target.value)}
                />
              </label>
              <label>
                Minimum minutes
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={filters.min_duration ? Number(filters.min_duration) / 60 : ''}
                  onChange={(e) =>
                    updateFilter(
                      'min_duration',
                      e.target.value ? String(Number(e.target.value) * 60) : ''
                    )
                  }
                />
              </label>
              <label>
                Maximum minutes
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={filters.max_duration ? Number(filters.max_duration) / 60 : ''}
                  onChange={(e) =>
                    updateFilter(
                      'max_duration',
                      e.target.value ? String(Number(e.target.value) * 60) : ''
                    )
                  }
                />
              </label>
              <label>
                Transcript source
                <select
                  className="form-control"
                  value={filters.transcript_source}
                  onChange={(e) => updateFilter('transcript_source', e.target.value)}
                >
                  <option value="any">Any source</option>
                  <option value="whisper">HasanAra transcript</option>
                  <option value="youtube">YouTube captions</option>
                  <option value="both">Both sources</option>
                </select>
              </label>
            </div>
            <button type="button" className="btn-primary w-full" onClick={applyFilters}>
              Show results
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
