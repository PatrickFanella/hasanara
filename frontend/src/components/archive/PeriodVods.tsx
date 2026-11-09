import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services';
import type { PageInfo, VideoInfo } from '../../types/api';
import { formatDate, videoDate } from '../../features/archive/format';

type Props = { dateFrom: string; dateTo: string };

/** The library cursor covers the whole period, rather than its evidence sample. */
export default function PeriodVods({ dateFrom, dateTo }: Props) {
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [page, setPage] = useState<PageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const load = useCallback(
    async (cursor?: string, signal?: AbortSignal) => {
      setLoading(true);
      setError(false);
      try {
        const result = await api.listStreamLibrary(
          {
            date_from: dateFrom,
            date_to: dateTo,
            date_field: 'broadcast_date',
            sort: 'latest',
            limit: 12,
            cursor,
          },
          signal
        );
        if (signal?.aborted) return;
        setVideos((current) =>
          cursor
            ? [
                ...current,
                ...result.items.filter((video) => !current.some((item) => item.id === video.id)),
              ]
            : result.items
        );
        setPage(result.page_info);
      } catch {
        if (!signal?.aborted) setError(true);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [dateFrom, dateTo]
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(undefined, controller.signal);
    return () => controller.abort();
  }, [load, retry]);

  return (
    <div className="period-vods">
      <div className="period-vod-grid">
        {videos.map((video) => (
          <Link to={`/v/${video.id}`} key={video.id} className="period-vod">
            <img
              src={`https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              width="480"
              height="270"
            />
            <div>
              <h3>{video.title || 'Untitled VOD'}</h3>
              <span>{formatDate(videoDate(video))}</span>
            </div>
          </Link>
        ))}
      </div>
      {loading && (
        <p role="status" className="py-4 text-sm text-muted">
          Loading period VODs…
        </p>
      )}
      {error && (
        <div role="alert" className="py-3 text-sm text-muted">
          Period VODs could not be loaded.{' '}
          <button
            type="button"
            className="action-link"
            onClick={() =>
              page?.next_cursor ? void load(page.next_cursor) : setRetry((value) => value + 1)
            }
          >
            Retry VODs
          </button>
        </div>
      )}
      {!loading && !error && videos.length === 0 && (
        <p className="py-4 text-sm text-muted">No archived VODs in this date range.</p>
      )}
      {page?.has_next_page && (
        <button
          type="button"
          className="btn-secondary mt-3"
          disabled={loading}
          onClick={() => void load(page.next_cursor ?? undefined)}
        >
          Load more VODs
        </button>
      )}
      <Link
        className="action-link mt-3 block text-sm"
        to={`/episodes?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`}
      >
        Browse all VODs in this period
      </Link>
    </div>
  );
}
