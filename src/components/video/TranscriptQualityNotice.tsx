import type { TranscriptBlock } from '../../types/api';
type Props = {
  source?: 'whisper' | 'youtube' | 'merged';
  sourceLabel?: string;
  blocks: TranscriptBlock[];
};

export default function TranscriptQualityNotice(props: Props) {
  void props;
  return (
    <div className="transcript-quality" role="note" aria-labelledby="transcript-quality-title">
      <div>
        <div className="archive-eyebrow">Transcript quality</div>
        <h3 id="transcript-quality-title" className="mt-1 text-base font-semibold text-ink">
          Automated transcript
        </h3>
      </div>
      <p className="text-sm leading-6 text-muted">
        Automated transcripts can contain errors in wording, speakers, and timestamp alignment.
        Treat timestamps as navigation aids and verify quotations against the linked source video.
      </p>
    </div>
  );
}
