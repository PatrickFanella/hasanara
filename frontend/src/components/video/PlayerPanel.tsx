import type { RefObject } from 'react';
import type { VideoInfo } from '../../types/api';
import YouTubePlayer, { type YouTubePlayerHandle } from '../YouTubePlayer';

type Props = {
  video: VideoInfo | null;
  start: number;
  playerRef: RefObject<YouTubePlayerHandle | null>;
  className?: string;
};

export default function PlayerPanel({ video, start, playerRef, className = '' }: Props) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-border bg-[#09090b] shadow-[0_24px_70px_rgba(0,0,0,0.32)] ${className}`}
    >
      {video ? (
        <YouTubePlayer
          ref={playerRef}
          videoId={video.youtube_id}
          start={start}
          title={video?.title ?? undefined}
        />
      ) : (
        <div className="aspect-video w-full overflow-hidden bg-black">
          <div
            className="flex h-full items-center justify-center text-subtle"
            role="status"
            aria-live="polite"
          >
            <span className="mr-3 inline-block animate-spin text-3xl" aria-hidden="true">
              ⟳
            </span>
            Loading player…
          </div>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/75">
        <span>Source video</span>
        <span className="inline-flex items-center gap-1.5 text-player-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-player-accent" /> Synced transcript
        </span>
      </div>
    </div>
  );
}
