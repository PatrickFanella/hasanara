import { describe, expect, it } from 'vitest';
import {
  MAX_CHAPTER_SENTENCES,
  buildProgressiveTranscriptChapters,
  chapterForSegment,
  mountedChapterIndexes,
} from '../features/videoTranscript/progressiveChapters';

function segments(count: number, spacingMs = 10_000) {
  return Array.from({ length: count }, (_, index) => ({
    start_ms: index * spacingMs,
    end_ms: (index + 1) * spacingMs,
    text: `Sentence ${index + 1}`,
  }));
}

describe('progressive transcript chapters', () => {
  it('creates deterministic fallback chapters within the mounted control budget', () => {
    const chapters = buildProgressiveTranscriptChapters(segments(270));
    expect(chapters).toHaveLength(3);
    expect(chapters[0]).toMatchObject({ startSegment: 0, endSegment: 89 });
    expect(chapters[2]).toMatchObject({ startSegment: 180, endSegment: 269 });
    expect(
      MAX_CHAPTER_SENTENCES * mountedChapterIndexes(1, chapters.length).length
    ).toBeLessThanOrEqual(300);
  });

  it('honours transcript landmarks and the fifteen-minute cap', () => {
    const chapters = buildProgressiveTranscriptChapters(segments(40, 60_000), [
      { chapter_index: 0, start_ms: 0, end_ms: 1_200_000, title: 'Opening' },
      { chapter_index: 1, start_ms: 1_200_000, end_ms: 2_400_000, title: 'Interview' },
    ] as never);
    expect(chapters.map((chapter) => chapter.label)).toEqual([
      'Opening',
      'Opening',
      'Interview',
      'Interview',
    ]);
    expect(chapters.every((chapter) => chapter.endMs - chapter.startMs <= 15 * 60 * 1000)).toBe(
      true
    );
  });

  it('finds a deep link chapter and mounts only its immediate neighbours', () => {
    const chapters = buildProgressiveTranscriptChapters(segments(400));
    expect(chapterForSegment(chapters, 250)).toBe(2);
    expect(mountedChapterIndexes(2, chapters.length)).toEqual([1, 2, 3]);
    expect(mountedChapterIndexes(0, chapters.length)).toEqual([0, 1]);
  });
});
