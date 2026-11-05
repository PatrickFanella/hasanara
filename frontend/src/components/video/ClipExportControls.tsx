import { useEffect, useRef, useState } from 'react';
import { HTTPError } from 'ky';
import { useAuth } from '../../services';
import { apiAddFavorite, buildApiUrl, http } from '../../services/api';
import { formatPassageTime, type PassageRange } from '../../features/passages/range';

type ClipJob = { id: string; status: string; expires_at: number; error?: string | null };
export default function ClipExportControls({
  videoId,
  range,
}: {
  videoId: string;
  range: PassageRange;
}) {
  const { user } = useAuth();
  const [job, setJob] = useState<ClipJob>();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const downloadedId = useRef<string | undefined>(undefined);
  const pending = job?.status === 'queued' || job?.status === 'running';

  useEffect(() => {
    if (!pending || !job || !user) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setJob(await http.get(`clips/${job.id}`, { signal: controller.signal }).json<ClipJob>());
        setError('');
      } catch (cause) {
        if (!controller.signal.aborted) {
          if (cause instanceof HTTPError && [401, 403, 404].includes(cause.response.status)) {
            setJob(undefined);
            setError('This export is no longer available. Sign in and export the range again.');
            return;
          }
          setError('Could not check the export. Retrying automatically…');
          setJob({ ...job });
        }
      }
    }, 2000);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [job, pending, user]);

  useEffect(() => {
    if (user && job?.status === 'completed' && downloadedId.current !== job.id) {
      downloadedId.current = job.id;
      downloadRef.current?.click();
    }
  }, [job, user]);

  async function request() {
    setBusy(true);
    setError('');
    setJob(undefined);
    downloadedId.current = undefined;
    try {
      setJob(
        await http
          .post('clips', {
            json: { video_id: videoId, start_ms: range.startMs, end_ms: range.endMs },
          })
          .json<ClipJob>()
      );
    } catch {
      setError(
        'Export unavailable. Check that the source is available, select at most two minutes, and try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveRange() {
    setSaving(true);
    setError('');
    try {
      await apiAddFavorite({
        video_id: videoId,
        start_ms: range.startMs,
        end_ms: range.endMs,
        text: `Clip ${formatPassageTime(range.startMs)}–${formatPassageTime(range.endMs)}`,
      });
      setSaved(true);
    } catch {
      setError('Could not save this range. Try saving again.');
    } finally {
      setSaving(false);
    }
  }

  if (!user)
    return <p className="text-sm text-muted mt-4">Sign in to save ranges and download clips.</p>;
  return (
    <section className="mt-4 border-t border-border pt-4 space-y-2" aria-label="Clip export">
      <h3 className="font-semibold">Download selected clip</h3>
      <p className="text-sm text-muted">
        Up to two minutes. Your download starts automatically when the MP4 is ready. Keep this page
        open until it starts. Server copies expire; save the range to generate another copy later.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || pending || range.endMs - range.startMs > 120000}
          onClick={() => void request()}
        >
          {busy || pending ? 'Preparing clip…' : 'Export and download'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={saving || saved}
          onClick={() => void saveRange()}
        >
          {saved ? 'Range saved' : saving ? 'Saving…' : 'Save range'}
        </button>
      </div>
      {saved && (
        <p role="status">
          Range saved in{' '}
          <a className="action-link" href="/saved">
            Saved moments
          </a>
          . Reopen it to export again.
        </p>
      )}
      {job && (
        <div className="space-y-2">
          <p role="status">
            {job.status === 'completed'
              ? `Download requested. Server copy expires ${new Date(job.expires_at * 1000).toLocaleString()}.`
              : job.status === 'expired'
                ? 'Server copy expired. Export again to regenerate it.'
                : `Export ${job.status}.`}
          </p>
          {job.error && <p role="alert">{job.error}</p>}
          {job.status === 'completed' && (
            <>
              <a
                ref={downloadRef}
                className="btn-primary"
                href={buildApiUrl(`clips/${job.id}/download`)}
                download
              >
                Download MP4 again
              </a>
              <p className="text-sm text-muted">
                If your browser blocked the automatic download, use the link above.
              </p>
            </>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
