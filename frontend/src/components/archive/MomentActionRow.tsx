import { Link } from 'react-router-dom';
import type { SearchHit } from '../../types/api';

type MomentActionRowProps = {
  videoId: string;
  moment: SearchHit;
  query: string;
  saved: boolean;
  onOpenTimestamp: () => void;
  onCopyTimestamp: () => void;
  onCopyQuote: () => void;
  onSaveMoment: () => void;
};

export default function MomentActionRow(props: MomentActionRowProps) {
  const { videoId, saved, onCopyTimestamp, onCopyQuote, onSaveMoment } = props;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-2 border-t border-border/60 pt-3 text-xs">
      <button
        type="button"
        className="btn-ghost min-h-11 px-2 text-xs"
        aria-label={saved ? 'Saved moment' : 'Save moment'}
        disabled={saved}
        onClick={onSaveMoment}
      >
        {saved ? 'Saved' : 'Save'}
      </button>
      <button type="button" className="btn-ghost min-h-11 px-2 text-xs" onClick={onCopyTimestamp}>
        Share
      </button>
      <details className="relative ml-auto">
        <summary
          className="btn-ghost min-h-11 cursor-pointer list-none px-3 text-xs"
          aria-label="More moment actions"
        >
          More
        </summary>
        <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-border bg-surface-raised p-1 shadow-xl">
          <button
            type="button"
            className="btn-ghost w-full justify-start text-xs"
            onClick={onCopyTimestamp}
          >
            Copy link
          </button>
          <button
            type="button"
            className="btn-ghost w-full justify-start text-xs"
            onClick={onCopyQuote}
          >
            Copy quote
          </button>
          <Link to={`/v/${videoId}`} className="btn-ghost w-full justify-start text-xs">
            Full VOD
          </Link>
        </div>
      </details>
    </div>
  );
}
