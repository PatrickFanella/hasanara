import { useCallback, useEffect, useRef, useState } from 'react';
import { buildApiUrl, http } from '../../services/api';

type EventRow = {
  id: number;
  created_at: string;
  user_id?: string | null;
  analytics_subject_id?: string | null;
  type: string;
  payload: Record<string, unknown>;
};
type PageInfo = {
  limit: number;
  offset: number;
  has_next_page: boolean;
  has_previous_page: boolean;
  next_offset: number | null;
  previous_offset: number | null;
};
type EventResponse = { items: EventRow[]; page_info?: PageInfo };
type Summary = {
  by_type: Array<{ type: string; count: number }>;
  by_day: Array<{ day: string; count: number }>;
};

function paramsFor(
  filters: { type: string; email: string; start: string; end: string },
  offset = 0
) {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.email) params.set('user_email', filters.email);
  if (filters.start) params.set('start', filters.start);
  if (filters.end) params.set('end', filters.end);
  params.set('limit', '25');
  params.set('offset', String(offset));
  return params;
}

export default function AdminEvents() {
  const [draft, setDraft] = useState({ type: '', email: '', start: '', end: '' });
  const [filters, setFilters] = useState(draft);
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<EventRow[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [eventsState, setEventsState] = useState<'loading' | 'success' | 'error'>('loading');
  const [summaryState, setSummaryState] = useState<'loading' | 'success' | 'error'>('loading');
  const [eventsError, setEventsError] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [compact, setCompact] = useState(
    () => window.matchMedia?.('(max-width: 767px)').matches ?? false
  );
  const eventsAbort = useRef<AbortController | null>(null);
  const summaryAbort = useRef<AbortController | null>(null);

  const loadEvents = useCallback(
    async (activeFilters = filters, activeOffset = offset) => {
      eventsAbort.current?.abort();
      const controller = new AbortController();
      eventsAbort.current = controller;
      setEventsState('loading');
      setEventsError('');
      try {
        const response = await http
          .get('admin/events', {
            searchParams: paramsFor(activeFilters, activeOffset),
            signal: controller.signal,
          })
          .json<EventResponse>();
        if (controller.signal.aborted) return;
        setItems(response.items ?? []);
        setPageInfo(response.page_info ?? null);
        setEventsState('success');
      } catch (error) {
        if (controller.signal.aborted) return;
        setEventsState('error');
        setEventsError(error instanceof Error ? error.message : 'Failed to load events.');
      }
    },
    [filters, offset]
  );
  const loadSummary = useCallback(
    async (activeFilters = filters) => {
      summaryAbort.current?.abort();
      const controller = new AbortController();
      summaryAbort.current = controller;
      setSummaryState('loading');
      setSummaryError('');
      const params = paramsFor(activeFilters);
      params.delete('limit');
      params.delete('offset');
      params.delete('type');
      params.delete('user_email');
      try {
        const response = await http
          .get('admin/events/summary', { searchParams: params, signal: controller.signal })
          .json<Summary>();
        if (controller.signal.aborted) return;
        setSummary(response);
        setSummaryState('success');
      } catch (error) {
        if (controller.signal.aborted) return;
        setSummaryState('error');
        setSummaryError(error instanceof Error ? error.message : 'Failed to load summary.');
      }
    },
    [filters]
  );
  useEffect(() => {
    void loadEvents();
    return () => eventsAbort.current?.abort();
  }, [loadEvents]);
  useEffect(() => {
    void loadSummary();
    return () => summaryAbort.current?.abort();
  }, [loadSummary]);
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 767px)');
    if (!media) return;
    const change = () => setCompact(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const invalidRange = Boolean(draft.start && draft.end && draft.end < draft.start);
  function apply() {
    if (invalidRange) return;
    setOffset(0);
    setFilters(draft);
  }
  const isPending = eventsState === 'loading' || summaryState === 'loading';
  const exportParams = paramsFor(filters, offset);
  exportParams.delete('limit');
  exportParams.delete('offset');
  return (
    <div className="space-y-6">
      <header>
        <div className="archive-eyebrow">Administration / activity</div>
        <h1 className="page-title mt-4">Events</h1>
        <p className="mt-2 text-muted">Inspect archive activity and event trends.</p>
      </header>
      <div className="surface-card">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              ['Type', 'type', 'text'],
              ['User Email', 'email', 'email'],
              ['Start', 'start', 'datetime-local'],
              ['End', 'end', 'datetime-local'],
            ] as const
          ).map(([label, key, inputType]) => (
            <div key={key} className="min-w-0">
              <label className="mb-1 block text-sm font-medium text-ink" htmlFor={`event-${key}`}>
                {label}
              </label>
              <input
                id={`event-${key}`}
                type={inputType}
                value={draft[key]}
                onChange={(event) => setDraft((value) => ({ ...value, [key]: event.target.value }))}
                className="form-control w-full min-w-0"
              />
            </div>
          ))}
          <div className="flex items-end gap-2">
            <button
              className="btn"
              type="button"
              onClick={apply}
              disabled={isPending || invalidRange}
            >
              {isPending ? 'Loading…' : 'Apply'}
            </button>
            <a className="btn" href={buildApiUrl('admin/events.csv', exportParams)}>
              Export CSV
            </a>
          </div>
        </div>
        {invalidRange && (
          <p className="mt-3 text-sm text-danger" role="alert">
            End date must be on or after the start date.
          </p>
        )}
      </div>
      <div aria-live="polite" className="sr-only">
        {eventsState === 'loading'
          ? 'Loading events'
          : summaryState === 'loading'
            ? 'Loading event summary'
            : ''}
      </div>
      {summaryState === 'error' ? (
        <div className="alert-warning" role="alert">
          {summaryError}
          <button className="btn-secondary ml-3 text-sm" onClick={() => void loadSummary()}>
            Retry summary
          </button>
        </div>
      ) : summaryState === 'loading' ? (
        <div role="status" className="text-muted">
          Loading event summary…
        </div>
      ) : (
        summary && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="surface-card-compact">
              <h2 className="mb-2 font-semibold">By Type</h2>
              <ul className="text-sm">
                {summary.by_type.map((x) => (
                  <li key={x.type} className="flex justify-between">
                    <span>{x.type}</span>
                    <span>{x.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="surface-card-compact">
              <h2 className="mb-2 font-semibold">By Day</h2>
              <ul className="text-sm">
                {summary.by_day.map((x) => (
                  <li key={x.day} className="flex justify-between">
                    <span>{x.day}</span>
                    <span>{x.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )
      )}
      {eventsState === 'error' ? (
        <div className="alert-warning" role="alert">
          {eventsError}
          <button className="btn-secondary ml-3 text-sm" onClick={() => void loadEvents()}>
            Retry events
          </button>
        </div>
      ) : (
        <div className="surface-card overflow-hidden p-0">
          {eventsState === 'loading' ? (
            <div className="p-4 text-muted" role="status">
              Loading events…
            </div>
          ) : items.length === 0 ? (
            <p className="p-6 text-muted">No events match these filters.</p>
          ) : compact ? (
            <div className="divide-y divide-border">
              {items.map((event) => (
                <article className="space-y-1 p-4" key={event.id}>
                  <p className="font-semibold">
                    {event.type} <span className="font-normal text-muted">#{event.id}</span>
                  </p>
                  <p className="text-sm text-muted">
                    {new Date(event.created_at).toLocaleString()} · {event.user_id || 'anon'}
                  </p>
                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                </article>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <caption className="sr-only">Archive events</caption>
                <thead>
                  <tr className="border-b border-border bg-surface-muted">
                    <th className="px-2 py-2 text-left">ID</th>
                    <th className="px-2 py-2 text-left">Time</th>
                    <th className="px-2 py-2 text-left">User</th>
                    <th className="px-2 py-2 text-left">Type</th>
                    <th className="px-2 py-2 text-left">Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((event) => (
                    <tr key={event.id} className="border-b border-border align-top">
                      <td className="px-2 py-2">{event.id}</td>
                      <td className="px-2 py-2">{new Date(event.created_at).toLocaleString()}</td>
                      <td className="px-2 py-2">{event.user_id || 'anon'}</td>
                      <td className="px-2 py-2">{event.type}</td>
                      <td className="px-2 py-2">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {eventsState === 'success' && pageInfo && (
        <nav aria-label="Event pages" className="flex items-center gap-3">
          <span className="text-sm text-muted">
            Showing {pageInfo.offset + 1}–{pageInfo.offset + items.length}
          </span>
          <button
            className="btn-secondary"
            disabled={!pageInfo.has_previous_page || isPending}
            onClick={() => pageInfo.previous_offset != null && setOffset(pageInfo.previous_offset)}
          >
            Previous
          </button>
          <button
            className="btn-secondary"
            disabled={!pageInfo.has_next_page || isPending}
            onClick={() => pageInfo.next_offset != null && setOffset(pageInfo.next_offset)}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
