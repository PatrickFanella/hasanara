import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../../services/api';

type ChapterEvidence = {
  block_index: number;
  start_ms: number;
  end_ms: number;
  text: string;
};

type ChapterCandidate = {
  id: string;
  video_id: string;
  chapter_index: number;
  start_ms: number;
  end_ms: number;
  title: string | null;
  summary: string | null;
  confidence_score: number;
  status: 'candidate' | 'published' | 'rejected' | 'hidden';
  source: 'automatic' | 'manual' | 'hybrid';
  evidence: ChapterEvidence[];
  pipeline_version: string | null;
  model_name: string | null;
  prompt_version: string | null;
  transcript_source: 'whisper' | 'youtube' | null;
};

type ChapterCandidateSet = {
  video_id: string;
  youtube_id: string | null;
  video_title: string | null;
  duration_seconds: number | null;
  chapters: ChapterCandidate[];
};

type ChapterDraft = ChapterCandidate & {
  title: string;
  summary: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_PATTERN.test(value.trim());
}

function formatTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function draftsForSet(candidateSet: ChapterCandidateSet | null): ChapterDraft[] {
  return (candidateSet?.chapters ?? []).map((chapter) => ({
    ...chapter,
    title: chapter.title ?? `Chapter ${chapter.chapter_index + 1}`,
    summary: chapter.summary ?? '',
  }));
}

export default function AdminChapterReview() {
  const [candidateSets, setCandidateSets] = useState<ChapterCandidateSet[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [drafts, setDrafts] = useState<ChapterDraft[]>([]);
  const [videoFilter, setVideoFilter] = useState('');
  const [videoFilterDraft, setVideoFilterDraft] = useState('');
  const [generationVideoId, setGenerationVideoId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'publish' | 'reject' | 'generate' | ''>('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const selectedSet = useMemo(
    () => candidateSets.find((candidateSet) => candidateSet.video_id === selectedVideoId) ?? null,
    [candidateSets, selectedVideoId]
  );

  const selectSet = useCallback((candidateSet: ChapterCandidateSet | null) => {
    setSelectedVideoId(candidateSet?.video_id ?? '');
    setDrafts(draftsForSet(candidateSet));
  }, []);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError('');
    const searchParams = new URLSearchParams({ status: 'candidate', limit: '30', offset: '0' });
    if (videoFilter.trim()) searchParams.set('video_id', videoFilter.trim());
    try {
      const response = await http
        .get('admin/archive/chapter-candidates', { searchParams })
        .json<{ items?: ChapterCandidateSet[] } | ChapterCandidateSet[]>();
      const items = Array.isArray(response) ? response : (response.items ?? []);
      setCandidateSets(items);
      selectSet(items[0] ?? null);
    } catch (loadError) {
      console.error('Failed to load chapter candidates', loadError);
      setError('Failed to load chapter candidates.');
    } finally {
      setLoading(false);
    }
  }, [selectSet, videoFilter]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const updateDraft = (chapterId: string, patch: Partial<ChapterDraft>) => {
    setDrafts((current) =>
      current.map((chapter) => (chapter.id === chapterId ? { ...chapter, ...patch } : chapter))
    );
  };

  const generateCandidates = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const videoId = generationVideoId.trim();
    if (!videoId) return;
    if (!isUuid(videoId)) {
      setError('Enter a complete video UUID before generating candidates.');
      return;
    }
    setSaving('generate');
    setError('');
    setNotice('');
    try {
      const metrics = await http
        .post(`admin/archive/enrichment/generate/${videoId}`)
        .json<Record<string, unknown>>();
      const chapterCount = Number(metrics.chapters ?? 0);
      setNotice(`Generated ${chapterCount} review-only chapters for ${videoId}.`);
      setVideoFilterDraft(videoId);
      setVideoFilter(videoId);
    } catch (generationError) {
      console.error('Failed to generate enrichment candidates', generationError);
      setError(
        'Generation failed. Confirm enrichment is enabled, the model provider is reachable, and the video has a usable transcript.'
      );
    } finally {
      setSaving('');
    }
  };

  const reviewSet = async (action: 'publish' | 'reject') => {
    if (!selectedSet) return;
    setSaving(action);
    setError('');
    setNotice('');
    try {
      await http.post(`admin/archive/videos/${selectedSet.video_id}/chapters/review`, {
        json: {
          action,
          reason: reason.trim() || undefined,
          chapters:
            action === 'publish'
              ? drafts.map((chapter) => ({
                  id: chapter.id,
                  start_ms: chapter.start_ms,
                  title: chapter.title.trim(),
                  summary: chapter.summary.trim(),
                }))
              : [],
        },
      });
      setNotice(
        action === 'publish'
          ? `Published ${drafts.length} reviewed chapters for this VOD.`
          : `Rejected the ${drafts.length}-chapter candidate set.`
      );
      setReason('');
      setCandidateSets((current) =>
        current.filter((candidateSet) => candidateSet.video_id !== selectedSet.video_id)
      );
      const remaining = candidateSets.filter(
        (candidateSet) => candidateSet.video_id !== selectedSet.video_id
      );
      selectSet(remaining[0] ?? null);
    } catch (reviewError) {
      console.error('Failed to review chapter set', reviewError);
      setError(`Failed to ${action} the chapter set. Check boundaries and required titles.`);
    } finally {
      setSaving('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="page-title">Chapter review</h1>
        <p className="max-w-3xl text-sm text-muted">
          Review one complete VOD outline at a time. Nothing in this queue is public until the whole
          set is published; transcript citations and every editorial change are retained.
        </p>
      </div>

      {(notice || error) && (
        <div className="surface-card space-y-1 text-sm" aria-live="polite">
          {notice && (
            <div className="text-success" role="status">
              {notice}
            </div>
          )}
          {error && (
            <div className="text-red-500" role="alert">
              {error}
            </div>
          )}
        </div>
      )}

      <section className="surface-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Generate a candidate set</h2>
          <p className="text-sm text-muted">
            This runs the configured grounded enrichment model for one editor-selected video and
            writes candidates only.
          </p>
        </div>
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={generateCandidates}>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="chapter-video-id">
              Video ID
            </label>
            <input
              id="chapter-video-id"
              className="form-control"
              value={generationVideoId}
              onChange={(event) => setGenerationVideoId(event.target.value)}
              placeholder="UUID"
            />
          </div>
          <button
            className="btn-primary self-end"
            type="submit"
            disabled={saving === 'generate' || !isUuid(generationVideoId)}
          >
            {saving === 'generate' ? 'Generating…' : 'Generate candidates'}
          </button>
        </form>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,340px)_1fr]">
        <section className="surface-card space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Episode queue</h2>
              <p className="text-sm text-muted">Candidate sets, newest first.</p>
            </div>
            {loading && (
              <span className="text-sm text-muted" role="status">
                Loading…
              </span>
            )}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const nextFilter = videoFilterDraft.trim();
              if (nextFilter && !isUuid(nextFilter)) {
                setError('Enter a complete video UUID before applying the filter.');
                return;
              }
              setError('');
              setVideoFilter(nextFilter);
            }}
          >
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="chapter-filter-id">
              Filter by video ID
            </label>
            <div className="flex gap-2">
              <input
                id="chapter-filter-id"
                className="form-control"
                value={videoFilterDraft}
                onChange={(event) => setVideoFilterDraft(event.target.value)}
                placeholder="All candidate VODs"
              />
              <button
                className="btn-secondary"
                type="submit"
                disabled={Boolean(videoFilterDraft.trim()) && !isUuid(videoFilterDraft)}
              >
                Apply
              </button>
              {(videoFilter || videoFilterDraft) && (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => {
                    setVideoFilterDraft('');
                    setVideoFilter('');
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </form>
          <div className="max-h-[45rem] space-y-2 overflow-y-auto pr-1">
            {!loading && candidateSets.length === 0 && (
              <div className="rounded-md border border-border p-4 text-sm text-muted">
                No chapter sets are waiting for review.
              </div>
            )}
            {candidateSets.map((candidateSet) => (
              <button
                key={candidateSet.video_id}
                type="button"
                className={`w-full rounded-lg border p-3 text-left transition ${selectedSet?.video_id === candidateSet.video_id ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:bg-surface-muted'}`}
                onClick={() => selectSet(candidateSet)}
              >
                <div className="font-medium text-ink">
                  {candidateSet.video_title || candidateSet.youtube_id || candidateSet.video_id}
                </div>
                <div className="mt-1 text-xs text-muted">
                  {candidateSet.chapters.length} chapters ·{' '}
                  {formatTime((candidateSet.duration_seconds ?? 0) * 1000)}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="surface-card space-y-5">
          {!selectedSet ? (
            <div className="text-sm text-muted">Select a candidate episode to review it.</div>
          ) : (
            <>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-ink">
                    {selectedSet.video_title || 'Untitled VOD'}
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                    <span>{selectedSet.video_id}</span>
                    <span>{drafts.length} chapters</span>
                    <Link
                      className="text-primary hover:underline"
                      to={`/v/${selectedSet.video_id}`}
                    >
                      Open VOD
                    </Link>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-secondary"
                    type="button"
                    disabled={Boolean(saving) || !reason.trim()}
                    onClick={() => void reviewSet('reject')}
                    title={
                      !reason.trim() ? 'Add a review note before rejecting this set' : undefined
                    }
                  >
                    {saving === 'reject' ? 'Rejecting…' : 'Reject set'}
                  </button>
                  <button
                    className="btn-primary"
                    type="button"
                    disabled={Boolean(saving) || drafts.some((chapter) => !chapter.title.trim())}
                    onClick={() => void reviewSet('publish')}
                  >
                    {saving === 'publish' ? 'Publishing…' : 'Publish reviewed set'}
                  </button>
                </div>
              </div>

              <div>
                <label
                  className="mb-1 block text-sm font-medium text-ink"
                  htmlFor="chapter-review-reason"
                >
                  Review note
                </label>
                <input
                  id="chapter-review-reason"
                  className="form-control"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Why boundaries or titles changed"
                />
              </div>

              <ol className="space-y-4">
                {drafts.map((chapter, index) => (
                  <li key={chapter.id} className="rounded-lg border border-border p-4">
                    <div className="grid gap-4 lg:grid-cols-[130px_1fr]">
                      <div>
                        <label
                          className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted"
                          htmlFor={`chapter-start-${chapter.id}`}
                        >
                          Start (seconds)
                        </label>
                        <input
                          id={`chapter-start-${chapter.id}`}
                          className="form-control"
                          type="number"
                          min={0}
                          step={1}
                          disabled={index === 0}
                          value={Math.floor(chapter.start_ms / 1000)}
                          onChange={(event) =>
                            updateDraft(chapter.id, {
                              start_ms: Math.max(0, Number(event.target.value) * 1000),
                            })
                          }
                        />
                        <div className="mt-1 text-xs text-muted">
                          {formatTime(chapter.start_ms)}–
                          {formatTime(
                            drafts[index + 1]?.start_ms ??
                              (selectedSet.duration_seconds ?? 0) * 1000
                          )}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label
                            className="mb-1 block text-sm font-medium text-ink"
                            htmlFor={`chapter-title-${chapter.id}`}
                          >
                            Chapter {index + 1} title
                          </label>
                          <input
                            id={`chapter-title-${chapter.id}`}
                            className="form-control"
                            maxLength={100}
                            value={chapter.title}
                            onChange={(event) =>
                              updateDraft(chapter.id, { title: event.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label
                            className="mb-1 block text-sm font-medium text-ink"
                            htmlFor={`chapter-summary-${chapter.id}`}
                          >
                            Summary
                          </label>
                          <textarea
                            id={`chapter-summary-${chapter.id}`}
                            className="form-control min-h-20"
                            maxLength={500}
                            value={chapter.summary}
                            onChange={(event) =>
                              updateDraft(chapter.id, { summary: event.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-border pt-3">
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                        <span>{Math.round(chapter.confidence_score * 100)}% confidence</span>
                        <span>{chapter.model_name || 'unknown model'}</span>
                        <span>
                          {chapter.prompt_version || chapter.pipeline_version || 'unversioned'}
                        </span>
                        <span>{chapter.transcript_source || 'unknown transcript source'}</span>
                      </div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm font-medium text-ink">
                          Evidence ({chapter.evidence.length})
                        </summary>
                        <ul className="mt-2 space-y-2 text-sm text-muted">
                          {chapter.evidence.map((evidence) => (
                            <li key={`${chapter.id}-${evidence.block_index}`}>
                              <Link
                                className="text-primary hover:underline"
                                to={`/v/${selectedSet.video_id}?t=${Math.floor(evidence.start_ms / 1000)}`}
                              >
                                {formatTime(evidence.start_ms)}
                              </Link>{' '}
                              {evidence.text}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
