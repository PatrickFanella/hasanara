import { useCallback, useEffect, useRef, useState } from 'react';
import { HTTPError } from 'ky';
import { useAuth } from '../../services';
import { apiAddFavorite, http } from '../../services/api';
import ClipHandoffControls from './ClipHandoffControls';
import { formatPassageTime, type PassageRange } from '../../features/passages/range';

type ClipJob = { id: string; status: string; expires_at: number; error?: string | null };
type Props = { videoId: string; range: PassageRange };
export default function ClipExportControls(props: Props) {
  const { user } = useAuth();
  if (!user)
    return <p className="text-sm text-muted mt-4">Sign in to save ranges and download clips.</p>;
  return (
    <OwnedClipExportControls
      key={`${user.id}:${props.videoId}:${props.range.startMs}:${props.range.endMs}`}
      {...props}
    />
  );
}

function OwnedClipExportControls({ videoId, range }: Props) {
  const [job, setJob] = useState<ClipJob>();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const mediaController = useRef<AbortController | null>(null);
  const mediaUrl = useRef<string | undefined>(undefined);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const downloadedId = useRef<string | undefined>(undefined);
  const requestController = useRef<AbortController | null>(null);
  const pending = job?.status === 'queued' || job?.status === 'running';

  useEffect(() => {
    const controller = new AbortController();
    requestController.current = controller;
    return () => {
      controller.abort();
      mediaController.current?.abort();
      if (mediaUrl.current) URL.revokeObjectURL(mediaUrl.current);
    };
  }, []);

  useEffect(() => {
    if (job?.status !== 'completed') return;
    const timer = window.setTimeout(
      () =>
        setJob({ ...job, status: job.expires_at * 1000 <= Date.now() ? 'expired' : job.status }),
      Math.min(2147483647, Math.max(0, job.expires_at * 1000 - Date.now()))
    );
    return () => window.clearTimeout(timer);
  }, [job]);

  useEffect(() => {
    if (!pending || !job) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const next = await http
          .get(`clips/${job.id}`, { signal: controller.signal })
          .json<ClipJob>();
        if (!controller.signal.aborted) {
          setJob(next);
          setError('');
        }
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
  }, [job, pending]);

  const downloadMp4 = useCallback(async () => {
    if (!job || job.status !== 'completed' || job.expires_at * 1000 <= Date.now()) return;
    mediaController.current?.abort();
    const controller = new AbortController();
    mediaController.current = controller;
    setDownloading(true);
    setError('');
    try {
      const blob = await http
        .get(`clips/${job.id}/download`, { signal: controller.signal, timeout: false })
        .blob();
      if (controller.signal.aborted) return;
      if (mediaUrl.current) URL.revokeObjectURL(mediaUrl.current);
      mediaUrl.current = URL.createObjectURL(blob);
      const link = downloadRef.current!;
      link.href = mediaUrl.current;
      link.click();
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof HTTPError && [401, 403, 404].includes(cause.response.status)) {
        setJob(undefined);
        setError('This export is no longer available. Sign in and export the range again.');
      } else {
        setError('Could not download the MP4. Try Download MP4 again.');
      }
    } finally {
      if (!controller.signal.aborted) setDownloading(false);
    }
  }, [job]);

  useEffect(() => {
    if (job?.status === 'completed' && downloadedId.current !== job.id) {
      downloadedId.current = job.id;
      void downloadMp4();
    }
    return () => mediaController.current?.abort();
  }, [job, downloadMp4]);

  async function request() {
    setBusy(true);
    setError('');
    setJob(undefined);
    downloadedId.current = undefined;
    const signal = requestController.current!.signal;
    try {
      const next = await http
        .post('clips', {
          signal,
          json: { video_id: videoId, start_ms: range.startMs, end_ms: range.endMs },
        })
        .json<ClipJob>();
      if (!signal.aborted) setJob(next);
    } catch {
      if (signal.aborted) return;
      setError(
        'Export unavailable. Check that the source is available, select at most two minutes, and try again.'
      );
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }

  async function saveRange() {
    setSaving(true);
    setError('');
    const signal = requestController.current!.signal;
    try {
      await apiAddFavorite({
        video_id: videoId,
        start_ms: range.startMs,
        end_ms: range.endMs,
        text: `Clip ${formatPassageTime(range.startMs)}–${formatPassageTime(range.endMs)}`,
      });
      if (!signal.aborted) setSaved(true);
    } catch {
      if (signal.aborted) return;
      setError('Could not save this range. Try saving again.');
    } finally {
      if (!signal.aborted) setSaving(false);
    }
  }

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
              <button
                type="button"
                className="btn-primary"
                disabled={downloading}
                onClick={() => void downloadMp4()}
              >
                Download MP4 again
              </button>
              <a ref={downloadRef} download={`passage-${job.id}.mp4`} hidden />
              <p className="text-sm text-muted">
                If your browser blocked the automatic download, choose Download MP4 again.
              </p>
              <ClipHandoffControls
                jobId={job.id}
                videoId={videoId}
                range={range}
                onUnavailable={() => {
                  setJob(undefined);
                  setError(
                    'This export is no longer available. Sign in and export the range again.'
                  );
                }}
              />
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
