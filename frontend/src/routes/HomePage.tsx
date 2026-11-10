import { useSite } from '../services/site';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useAuth } from '../services';
import type { ArchiveSummary } from '../types/api';
import {
  buildTimestampLink,
  durationParts,
  formatDate,
  formatNumber,
} from '../features/archive/format';
import { VideoCard } from '../components/archive';
import { AsyncError } from '../components/async/AsyncFeedback';

const searchExamples = ['labor', 'Gaza', 'housing', 'election'];

// Frequent terms that are ordinary words on their own and make poor starting points.
const genericSearchTerms = new Set([
  'andrew',
  'built',
  'close',
  'commercials',
  'controlled',
  'creation',
  'neighborhoods',
  'retaliated',
  'shipped',
  'slur',
  'warning',
]);

function RuntimeValue({ seconds }: { seconds: number }) {
  const parts = durationParts(seconds);
  return (
    <>
      <span className="sr-only">
        {parts
          .map(
            (part) =>
              `${formatNumber(part.value)} ${part.value === 1 ? part.name.slice(0, -1) : part.name}`
          )
          .join(', ')}
      </span>
      <span aria-hidden="true">
        {parts.map((part) => (
          <span key={part.unit} className="archive-data-part">
            {formatNumber(part.value)}
            <span className="archive-data-unit">{part.unit}</span>
          </span>
        ))}
      </span>
    </>
  );
}

export default function HomePage() {
  const site = useSite();
  const navigate = useNavigate();
  const { user, loading: authLoading, login, loginTwitch } = useAuth();
  const [summary, setSummary] = useState<ArchiveSummary | null>(null);
  const [query, setQuery] = useState('');
  const [summaryState, setSummaryState] = useState<'loading' | 'success' | 'error'>('loading');
  const [popularTerms, setPopularTerms] = useState<string[]>([]);
  const summaryController = useRef<AbortController | null>(null);

  const loadSummary = useCallback(() => {
    summaryController.current?.abort();
    const controller = new AbortController();
    summaryController.current = controller;
    setSummaryState('loading');
    api
      .getArchiveSummary(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) {
          setSummary(next);
          setSummaryState('success');
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          console.error('Failed to load archive summary', err);
          setSummaryState('error');
        }
      });
  }, []);

  useEffect(() => {
    loadSummary();
    return () => summaryController.current?.abort();
  }, [loadSummary]);

  useEffect(() => {
    const controller = new AbortController();
    api
      .getPopularSearches(40, controller.signal)
      .then((response) => {
        setPopularTerms((response.suggestions ?? []).map((item) => item.term));
      })
      .catch(() => {
        // The archive summary still supplies a shorter list.
      });
    return () => controller.abort();
  }, []);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  const recentVideos = summary?.recent_videos ?? [];
  const suggested = (
    popularTerms.length > 0
      ? popularTerms
      : (summary?.popular_searches ?? []).map((item) => item.term)
  ).filter((term) => !genericSearchTerms.has(term.toLowerCase()));
  const stats = [
    { label: 'Searchable VODs', value: summary ? formatNumber(summary.video_count) : '—' },
    {
      label: 'Recorded runtime',
      value: summary ? <RuntimeValue seconds={summary.total_duration_seconds} /> : '—',
    },
    {
      label: 'Transcript words',
      value: summary ? formatNumber(summary.transcript_word_count) : '—',
    },
    {
      label: 'Index refreshed',
      value:
        summaryState === 'loading' && !summary
          ? 'Checking…'
          : formatDate(summary?.updated_at ?? null),
    },
  ];
  const newestVideo = recentVideos[0];

  return (
    <div className="space-y-5 lg:space-y-7">
      <section className="archive-masthead">
        <div className="home-masthead-grid relative z-10">
          <div className="space-y-5">
            <div className="eyebrow-rule">
              <span className="archive-eyebrow">{site.creator_name} broadcast archive</span>
            </div>

            <div className="space-y-4">
              <h1 className="archive-display">Search the broadcast archive.</h1>
              <p className="max-w-2xl text-base leading-7 text-muted sm:text-lg">
                Search years of broadcasts by topic or exact phrase, then move from the result
                straight into the cited transcript and VOD.
              </p>
            </div>
          </div>

          <div className="space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <form onSubmit={onSubmit} className="archive-command">
              <label className="sr-only" htmlFor="home-search">
                Search {site.name}
              </label>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex min-w-0 items-center gap-3 px-3">
                  <svg
                    className="h-5 w-5 shrink-0 text-subtle"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="7" strokeWidth="1.8" />
                    <path d="m20 20-4-4" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <input
                    id="home-search"
                    name="q"
                    type="search"
                    autoComplete="off"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Topic or phrase…"
                    className="min-h-11 min-w-0 w-full bg-transparent text-lg text-ink outline-none placeholder:text-subtle"
                  />
                </div>
                <button type="submit" className="btn min-h-11 px-7">
                  Search archive
                </button>
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
              <span className="mr-1 uppercase tracking-[0.18em]">Try</span>
              {searchExamples.map((term) => (
                <Link
                  key={term}
                  to={`/search?q=${encodeURIComponent(term)}`}
                  className="source-pill hover:border-accent/50 hover:text-ink"
                >
                  {term}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm lg:col-start-1 lg:self-start">
            <Link to="/explore" className="action-link font-semibold">
              Explore the archive →
            </Link>
            <Link to="/episodes" className="text-muted transition-colors hover:text-ink">
              Browse every VOD
            </Link>
          </div>
        </div>

        <div className="archive-data-strip relative z-10">
          {stats.map((stat) => (
            <div key={stat.label} className="archive-data-cell">
              <div className="meta-label">{stat.label}</div>
              <div className="archive-data-value">{stat.value}</div>
            </div>
          ))}
        </div>
      </section>

      {summaryState === 'error' && (
        <AsyncError onRetry={loadSummary} retryLabel="Retry archive summary">
          Archive summary is unavailable.{' '}
          {summary
            ? 'The last successful archive snapshot is still shown.'
            : 'Try again to load archive totals and recent VODs.'}
        </AsyncError>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="archive-section space-y-5">
          <div className="eyebrow-rule">
            <h2>
              <span className="archive-eyebrow">Latest broadcasts</span>
            </h2>
            <Link to="/episodes" className="action-link text-sm">
              All VODs →
            </Link>
          </div>

          {recentVideos.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {recentVideos.slice(0, 6).map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
              {summaryState === 'loading' && !summary
                ? 'Loading recent VODs…'
                : summaryState === 'error'
                  ? 'Recent VODs could not be loaded. Retry the archive summary.'
                  : 'No recent VODs are available yet.'}
            </div>
          )}
        </div>

        <section aria-label="Archive highlights" className="archive-section flex flex-col gap-5">
          {newestVideo && (
            <Link
              to={buildTimestampLink(newestVideo.id, 0)}
              className="rounded-xl border border-accent/20 bg-accent-soft/55 p-4 transition-colors hover:border-accent/50"
            >
              <div className="meta-label text-accent">Newest transcript</div>
              <div className="mt-2 line-clamp-2 font-semibold text-ink">
                {newestVideo.title || 'Open the newest VOD'}
              </div>
              <div className="mt-3 text-sm text-accent">Start reading →</div>
            </Link>
          )}

          <div className="space-y-4">
            <div className="eyebrow-rule">
              <h2>
                <span className="archive-eyebrow">Popular searches</span>
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggested.length > 0 ? (
                suggested.slice(0, 16).map((term) => (
                  <Link
                    key={term}
                    to={`/search?q=${encodeURIComponent(term)}`}
                    className="topic-chip"
                  >
                    {term}
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted">
                  {summaryState === 'error'
                    ? 'Popular searches could not be loaded. Retry the archive summary.'
                    : 'Search activity will surface useful starting points here.'}
                </p>
              )}
            </div>
          </div>
        </section>
      </section>

      <section className="archive-section">
        {!authLoading && !user ? (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div>
              <div className="archive-eyebrow">Save your archive trail</div>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-ink">
                Sign in to synchronize saved moments and searches.
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={login} className="btn min-h-11 px-4 text-sm">
                Continue with Google
              </button>
              <button
                type="button"
                onClick={loginTwitch}
                className="btn-secondary min-h-11 px-4 text-sm"
              >
                Continue with Twitch
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="archive-eyebrow">Archive trail</div>
              <p className="mt-2 font-semibold text-ink">
                {authLoading ? 'Checking your account…' : 'Your saves are synchronized.'}
              </p>
            </div>
            {!authLoading && (
              <Link to="/saved" className="btn-secondary min-h-11 px-4 text-sm">
                Open my saves
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
