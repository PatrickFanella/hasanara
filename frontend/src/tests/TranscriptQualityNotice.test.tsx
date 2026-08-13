import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TranscriptQualityNotice from '../components/video/TranscriptQualityNotice';

describe('TranscriptQualityNotice', () => {
  it('keeps the automated-transcript warning source neutral', () => {
    render(
      <TranscriptQualityNotice
        source="merged"
        sourceLabel="Merged transcript"
        blocks={[
          {
            block_index: 0,
            kind: 'paragraph',
            start_ms: 0,
            end_ms: 1000,
            text: 'Example',
            segment_ids: [0],
            needs_review: true,
          },
        ]}
      />
    );

    expect(screen.getByText('Automated transcript')).toBeVisible();
    expect(screen.getByText(/Automated transcripts can contain errors/)).toBeVisible();
    expect(
      screen.queryByText(/merged transcript|source disagreement|Source:/i)
    ).not.toBeInTheDocument();
  });
});
