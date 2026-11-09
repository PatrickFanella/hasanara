import { useEffect, useRef, useState } from 'react';
import { HTTPError } from 'ky';
import { http } from '../../services/api';
import type { components } from '../../types/generated/api';
import { formatPassageTime, type PassageRange } from '../../features/passages/range';

type ClipHandoff = components['schemas']['ClipHandoff'];

export default function ClipHandoffControls({
  jobId,
  videoId,
  range,
  onUnavailable,
}: {
  jobId: string;
  videoId: string;
  range: PassageRange;
  onUnavailable: () => void;
}) {
  const [handoff, setHandoff] = useState<ClipHandoff>();
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const controllerRef = useRef<AbortController | null>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const objectUrl = useRef<string | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    return () => {
      controller.abort();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, []);

  async function transfer(action: 'download' | 'copy') {
    const signal = controllerRef.current!.signal;
    setBusy(true);
    setError('');
    setFeedback('');
    setRaw('');
    setHandoff(undefined);
    try {
      // Recheck ownership, revocation, expiry and output integrity on every action.
      // Keep the producer document intact, including its request-time caption snapshot.
      const document = await http.get(`clips/${jobId}/handoff`, { signal }).text();
      if (signal.aborted) return;
      const next: ClipHandoff = JSON.parse(document);
      if (
        next.schema !== 'rekolekt.clip-handoff' ||
        next.schema_version !== 1 ||
        next.export_id !== jobId ||
        next.recording.video_id !== videoId ||
        next.passage.start_ms !== range.startMs ||
        next.passage.end_ms !== range.endMs ||
        !next.transcript ||
        !Array.isArray(next.captions?.cues) ||
        next.captions.cues.some((cue) => !cue || typeof cue.start_ms !== 'number')
      ) {
        throw new Error('Unexpected handoff');
      }
      setHandoff(next);
      setRaw(document);
      try {
        if (action === 'copy') {
          await navigator.clipboard.writeText(document);
          if (!signal.aborted)
            setFeedback('Handoff JSON copied. Save it as a .json file for clpr.');
        } else {
          if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
          objectUrl.current = URL.createObjectURL(
            new Blob([document], { type: 'application/json' })
          );
          const link = downloadRef.current!;
          link.href = objectUrl.current;
          link.click();
          setFeedback(
            'Handoff download requested. If it did not start, copy the JSON below into a .json file.'
          );
        }
      } catch {
        if (!signal.aborted)
          setFeedback('Select and copy the handoff JSON below, then save it as a .json file.');
      }
    } catch (cause) {
      if (signal.aborted) return;
      if (cause instanceof HTTPError && [401, 403, 404].includes(cause.response.status)) {
        onUnavailable();
        return;
      }
      setError(
        cause instanceof HTTPError && cause.response.status === 409
          ? 'This export has no captured provenance. Export the range again to create a handoff.'
          : 'Could not load the handoff. Try again. If the export is unavailable, export the range again.'
      );
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }

  return (
    <section className="space-y-2 pt-2" aria-label="clpr handoff">
      <h4 className="font-semibold">Review this clip in clpr</h4>
      <p className="text-sm text-muted">
        Download the version 1 handoff JSON, then open clpr and choose Upload video. Select the JSON
        under Archive handoff and review it before choosing Use in draft or Replace draft. Select
        the downloaded MP4 separately; clpr checks that it matches. You may need to sign in to clpr.
        Nothing is submitted or published by this handoff. Provenance does not prove rights to use
        the media.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => void transfer('download')}
        >
          Download handoff JSON (v1)
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={() => void transfer('copy')}
        >
          Copy handoff JSON
        </button>
        <a
          className="btn-secondary"
          href="https://clpr.tv/submit"
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
        >
          Open clpr draft importer
        </a>
      </div>
      <a ref={downloadRef} download={`passage-${jobId}.handoff.json`} hidden />
      {busy && <p role="status">Loading handoff…</p>}
      {handoff && (
        <div className="space-y-2 text-sm">
          <p className="break-all">
            Exported range: {formatPassageTime(handoff.passage.start_ms)}–
            {formatPassageTime(handoff.passage.end_ms)}. Transcript:{' '}
            {handoff.transcript.status === 'captured'
              ? `${handoff.transcript.source}, revision ${handoff.transcript.revision_sha256}.`
              : 'unavailable when this export was requested.'}
          </p>
          <p>
            {handoff.captions.timing !== 'clip-relative'
              ? 'Caption timing is unavailable or unsupported; no timing has been invented.'
              : handoff.captions.cues.length === 0
                ? 'No caption cues overlap this range.'
                : `${handoff.captions.cues.length} caption cues use times relative to the clip.`}
            {handoff.captions.cues.some((cue) => cue.end_ms === null) &&
              ' Some cues have no supported end time. Review their timing in clpr.'}
            {(handoff.captions.cues_truncated ||
              handoff.captions.cues.some((cue) => cue.text_truncated)) &&
              ' The producer shortened the captions; review them in clpr.'}
          </p>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {feedback && <p role="status">{feedback}</p>}
      {raw && (
        <label className="block text-sm">
          Handoff JSON
          <textarea
            readOnly
            value={raw}
            rows={6}
            className="mt-1 block w-full border border-border bg-surface p-2 font-mono text-xs"
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      )}
    </section>
  );
}
