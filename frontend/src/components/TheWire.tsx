import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services';
import { formatNumber } from '../features/archive/format';

type WireItem = { term: string; detail: string };

let wireRequest: Promise<WireItem[]> | null = null;

function loadWire(): Promise<WireItem[]> {
  wireRequest ??= api
    .getExploreIntelligence()
    .then((response) => {
      const items: WireItem[] = [];
      const seen = new Set<string>();
      const add = (term: string, detail: string) => {
        const key = term.trim().toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        items.push({ term: term.trim(), detail });
      };
      for (const card of response.topic_cards ?? [])
        add(
          card.label,
          card.recent_mentions_90d
            ? `${formatNumber(card.recent_mentions_90d)} mentions in 90 days`
            : `${formatNumber(card.total_moments)} mentions`
        );
      for (const search of response.trending_searches ?? []) add(search.term, 'trending search');
      for (const search of response.summary?.popular_searches ?? [])
        add(search.term, 'popular search');
      return items.slice(0, 16);
    })
    .catch(() => {
      wireRequest = null;
      return [];
    });
  return wireRequest;
}

/** A scrolling ticker of what the archive is talking about right now. */
export default function TheWire() {
  const [items, setItems] = useState<WireItem[]>([]);
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem('hasanara:wire') !== 'hidden';
    } catch {
      return true;
    }
  });
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let active = true;
    void loadWire().then((next) => {
      if (active) setItems(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const renderItems = (copy: boolean) =>
    items.map((item) => (
      <li key={`${copy ? 'b' : 'a'}:${item.term}`}>
        <Link
          to={`/search?q=${encodeURIComponent(item.term)}`}
          tabIndex={copy ? -1 : undefined}
          className="wire-item"
        >
          <strong>{item.term}</strong>
          <span>{item.detail}</span>
        </Link>
      </li>
    ));

  return (
    <section
      className="wire"
      aria-label="Trending in the archive"
      data-visible={visible}
      data-paused={paused}
    >
      <button
        type="button"
        className="wire-toggle"
        aria-label={visible ? 'Hide The Wire' : 'Show The Wire'}
        title={visible ? 'Hide The Wire' : 'Show The Wire'}
        aria-expanded={visible}
        aria-controls="wire-content"
        onClick={() =>
          setVisible((current) => {
            try {
              localStorage.setItem('hasanara:wire', current ? 'hidden' : 'visible');
            } catch {
              /* preference is optional */
            }
            return !current;
          })
        }
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 15 6-6 6 6" />
        </svg>
      </button>
      <div id="wire-content" className="wire-panel">
        <span className="wire-label">The Wire</span>
        <button
          type="button"
          className="wire-pause"
          aria-label={paused ? 'Resume ticker' : 'Pause ticker'}
          title={paused ? 'Resume ticker' : 'Pause ticker'}
          aria-pressed={paused}
          onClick={() => setPaused((current) => !current)}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {paused ? <path d="M8 5v14l11-7z" /> : <path d="M7 5h4v14H7zM13 5h4v14h-4z" />}
          </svg>
        </button>
        <div className="wire-track">
          {items.length > 0 && (
            <div className="wire-reel">
              <ul>{renderItems(false)}</ul>
              <ul aria-hidden="true">{renderItems(true)}</ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
