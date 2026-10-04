import type { Segment, TranscriptBlock, VideoChapter } from '../../types/api';
import type { TranscriptTurn } from './transcript';

export const MAX_CHAPTER_DURATION_MS = 15 * 60 * 1000;
// The active chapter and both neighbours are mounted together. Keeping each
// chapter below 100 sentence controls preserves the 300-control DOM budget.
export const MAX_CHAPTER_SENTENCES = 90;

export type ProgressiveTranscriptChapter = {
  index: number;
  label: string;
  startSegment: number;
  endSegment: number;
  startMs: number;
  endMs: number;
};

function landmarkAt(segment: Segment, landmarks: VideoChapter[]) {
  let current: VideoChapter | undefined;
  for (const landmark of landmarks) {
    if (landmark.start_ms > segment.start_ms) break;
    current = landmark;
  }
  return current;
}

export function buildProgressiveTranscriptChapters(
  segments: Segment[],
  landmarks: VideoChapter[] = []
): ProgressiveTranscriptChapter[] {
  if (segments.length === 0) return [];
  const orderedLandmarks = [...landmarks].sort((a, b) => a.start_ms - b.start_ms);
  const chapters: ProgressiveTranscriptChapter[] = [];
  let startSegment = 0;
  let currentLandmark = landmarkAt(segments[0], orderedLandmarks);

  const finish = (endSegment: number) => {
    const first = segments[startSegment];
    const last = segments[endSegment];
    if (!first || !last) return;
    chapters.push({
      index: chapters.length,
      label: currentLandmark?.title?.trim() || `Chapter ${chapters.length + 1}`,
      startSegment,
      endSegment,
      startMs: first.start_ms,
      endMs: last.end_ms,
    });
  };

  for (let segmentIndex = 1; segmentIndex < segments.length; segmentIndex += 1) {
    const segment = segments[segmentIndex];
    const nextLandmark = landmarkAt(segment, orderedLandmarks);
    const landmarkChanged = nextLandmark?.chapter_index !== currentLandmark?.chapter_index;
    const sentenceLimitReached = segmentIndex - startSegment >= MAX_CHAPTER_SENTENCES;
    const durationLimitReached =
      segment.start_ms - segments[startSegment].start_ms >= MAX_CHAPTER_DURATION_MS;
    if (landmarkChanged || sentenceLimitReached || durationLimitReached) {
      finish(segmentIndex - 1);
      startSegment = segmentIndex;
      currentLandmark = nextLandmark;
    }
  }
  finish(segments.length - 1);
  return chapters;
}

export function chapterForSegment(chapters: ProgressiveTranscriptChapter[], segmentIndex: number) {
  return chapters.findIndex(
    (chapter) => segmentIndex >= chapter.startSegment && segmentIndex <= chapter.endSegment
  );
}

export function mountedChapterIndexes(activeIndex: number, chapterCount: number) {
  if (chapterCount === 0) return [];
  const safe = Math.min(Math.max(activeIndex, 0), chapterCount - 1);
  return [safe - 1, safe, safe + 1].filter((index) => index >= 0 && index < chapterCount);
}

export function filterBlocksForChapters(
  blocks: TranscriptBlock[],
  chapters: ProgressiveTranscriptChapter[],
  mountedIndexes: number[]
) {
  const ranges = mountedIndexes.map((index) => chapters[index]).filter(Boolean);
  return blocks.filter((block) =>
    block.segment_ids.some((segmentIndex) =>
      ranges.some(
        (chapter) => segmentIndex >= chapter.startSegment && segmentIndex <= chapter.endSegment
      )
    )
  );
}

export function filterTurnsForChapters(
  turns: TranscriptTurn[],
  chapters: ProgressiveTranscriptChapter[],
  mountedIndexes: number[]
) {
  const ranges = mountedIndexes.map((index) => chapters[index]).filter(Boolean);
  return turns
    .map((turn) => ({
      ...turn,
      segments: turn.segments.filter(({ id }) =>
        ranges.some((chapter) => id - 1 >= chapter.startSegment && id - 1 <= chapter.endSegment)
      ),
    }))
    .filter((turn) => turn.segments.length > 0);
}
