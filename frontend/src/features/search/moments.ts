import type { HighlightRange, SearchHit } from '../../types/api';
import { buildTimestampLink, canonicalMomentId, formatTimestamp } from '../archive/format';
import { parseLegacyHighlightedSnippet } from './highlights';

export function plainTextFromSnippet(snippet: string, highlights?: HighlightRange[] | null) {
  const text = highlights == null ? parseLegacyHighlightedSnippet(snippet).text : snippet;
  return text.replace(/\s+/g, ' ').trim();
}

export function buildQuoteText(
  videoId: string,
  moment: SearchHit,
  title: string,
  origin = window.location.origin
) {
  const url = `${origin}${buildTimestampLink(videoId, moment.start_ms, moment.source)}`;
  return `“${plainTextFromSnippet(moment.snippet, moment.highlights)}”\n\n— ${title}, ${formatTimestamp(moment.start_ms)}\n${url}`;
}

export function buildPlayMatchesLink(videoId: string, moment: SearchHit, query: string) {
  const seconds = Math.floor(moment.start_ms / 1000);
  const source = moment.source ?? 'whisper';
  const params = new URLSearchParams({
    t: String(seconds),
    source,
    q: query,
    play: 'matches',
  });
  if (moment.start_ms % 1000 !== 0) params.set('t_ms', String(moment.start_ms));
  return `/v/${videoId}?${params.toString()}#${canonicalMomentId(source, moment.start_ms)}`;
}
