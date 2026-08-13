import { useState } from 'react';
import type { SearchHit } from '../../types/api';
import { formatTimestamp } from '../../features/archive/format';
import { buildTimestampLink } from '../../features/archive/format';
import { buildPlayMatchesLink } from '../../features/search/moments';
import { Link } from 'react-router-dom';
import { clusterNearbyMoments } from '../../features/search/clusters';
import HighlightedSnippet from '../HighlightedSnippet';
import MomentActionRow from './MomentActionRow';

type SearchMomentsListProps = {
  videoId: string;
  moments: SearchHit[];
  fallbackTitle: string;
  query: string;
  savedKeys: Set<string>;
  onSaveMoment: (videoId: string, moment: SearchHit, title: string) => void;
  onCopyTimestamp: (videoId: string, moment: SearchHit) => void;
  onCopyQuote: (videoId: string, moment: SearchHit, title: string) => void;
  onTrackResultClick: (videoId: string, moment: SearchHit) => void;
};

export default function SearchMomentsList({
  videoId,
  moments,
  fallbackTitle,
  query,
  savedKeys,
  onSaveMoment,
  onCopyTimestamp,
  onCopyQuote,
  onTrackResultClick,
}: SearchMomentsListProps) {
  const [showAllClusters, setShowAllClusters] = useState(false);
  const clusters = clusterNearbyMoments(moments);
  const visibleClusters = showAllClusters ? clusters : clusters.slice(0, 3);

  return (
    <ol className="divide-y divide-border/70">
      {visibleClusters.map((cluster, clusterIndex) => {
        const moment = cluster[0];
        if (!moment) return null;
        const key = `${videoId}:${moment.start_ms}:${moment.end_ms}`;

        return (
          <li key={moment.id} className="evidence-card group">
            <div className="grid gap-4 sm:grid-cols-[5rem_minmax(0,1fr)]">
              <div className="flex items-center gap-3 sm:block">
                <div className="font-mono text-[10px] text-subtle">
                  {String(clusterIndex + 1).padStart(2, '0')}
                </div>
                <time className="mt-0 block font-mono text-xs font-semibold text-warning sm:mt-2">
                  {formatTimestamp(moment.start_ms)}
                </time>
                <div className="mt-0 font-mono text-[9px] text-subtle sm:mt-1">
                  {formatTimestamp(moment.end_ms)}
                </div>
              </div>
              <div className="min-w-0">
                <Link
                  to={
                    query
                      ? buildPlayMatchesLink(videoId, moment, query)
                      : buildTimestampLink(videoId, moment.start_ms, moment.source)
                  }
                  className="block rounded-lg hover:bg-surface-muted focus:bg-surface-muted"
                  aria-label={`Play cited moment at ${formatTimestamp(moment.start_ms)}`}
                  onClick={() => onTrackResultClick(videoId, moment)}
                >
                  <HighlightedSnippet
                    as="div"
                    className="archive-snippet"
                    snippet={moment.snippet}
                    highlights={moment.highlights}
                  />
                </Link>
                <MomentActionRow
                  videoId={videoId}
                  moment={moment}
                  query={query}
                  saved={savedKeys.has(key)}
                  onOpenTimestamp={() => onTrackResultClick(videoId, moment)}
                  onCopyTimestamp={() => onCopyTimestamp(videoId, moment)}
                  onCopyQuote={() => onCopyQuote(videoId, moment, fallbackTitle)}
                  onSaveMoment={() => onSaveMoment(videoId, moment, fallbackTitle)}
                />
                {cluster.length > 1 && (
                  <details className="mt-3">
                    <summary className="action-link cursor-pointer">
                      {cluster.length - 1} nearby {cluster.length - 1 === 1 ? 'match' : 'matches'}
                    </summary>
                    <ol className="mt-3 space-y-3 border-l border-border pl-3">
                      {cluster.slice(1).map((nearbyMoment) => {
                        const nearbyKey = `${videoId}:${nearbyMoment.start_ms}:${nearbyMoment.end_ms}`;
                        return (
                          <li key={nearbyMoment.id} className="space-y-2">
                            <time className="font-mono text-xs font-semibold text-warning">
                              {formatTimestamp(nearbyMoment.start_ms)}
                            </time>
                            <HighlightedSnippet
                              as="div"
                              className="archive-snippet"
                              snippet={nearbyMoment.snippet}
                              highlights={nearbyMoment.highlights}
                            />
                            <MomentActionRow
                              videoId={videoId}
                              moment={nearbyMoment}
                              query={query}
                              saved={savedKeys.has(nearbyKey)}
                              onOpenTimestamp={() => onTrackResultClick(videoId, nearbyMoment)}
                              onCopyTimestamp={() => onCopyTimestamp(videoId, nearbyMoment)}
                              onCopyQuote={() => onCopyQuote(videoId, nearbyMoment, fallbackTitle)}
                              onSaveMoment={() =>
                                onSaveMoment(videoId, nearbyMoment, fallbackTitle)
                              }
                            />
                          </li>
                        );
                      })}
                    </ol>
                  </details>
                )}
              </div>
            </div>
          </li>
        );
      })}
      {!showAllClusters && clusters.length > visibleClusters.length && (
        <li className="px-5 py-4">
          <button type="button" className="action-link" onClick={() => setShowAllClusters(true)}>
            Show {clusters.length - visibleClusters.length} more moment clusters
          </button>
        </li>
      )}
    </ol>
  );
}
