import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services';
import { useSite } from '../services/site';
import type { ArchiveSummary } from '../types/api';
import { formatNumber, formatShortDuration } from '../features/archive/format';

const wordsPerKingJamesBible = 783137;

function buildFacts(summary: ArchiveSummary | null) {
  const videos = summary?.video_count || 0;
  const seconds = summary?.total_duration_seconds || 0;
  const words = summary?.transcript_word_count || 0;
  const bibles = Math.round(words / wordsPerKingJamesBible);
  const topSearch = summary?.popular_searches?.[0];
  return [
    { value: videos ? formatNumber(videos) : '—', caption: 'broadcasts you can search by phrase' },
    {
      value: seconds ? `${formatNumber(Math.floor(seconds / 86400))} days` : '—',
      caption: 'to watch everything back to back, without sleeping',
    },
    {
      value:
        words >= 1e6 ? `${(words / 1e6).toFixed(1)}M words` : words ? formatNumber(words) : '—',
      caption:
        bibles >= 2
          ? `of transcript, about ${formatNumber(bibles)} King James Bibles`
          : 'of transcript',
    },
    {
      value: videos && seconds ? formatShortDuration(seconds / videos) : '—',
      caption: 'average broadcast length',
    },
    {
      value: words && seconds ? `${Math.round(words / (seconds / 60))} wpm` : '—',
      caption: 'transcribed words per recorded minute',
    },
    ...(topSearch
      ? [
          {
            value: topSearch.term,
            caption: `most-searched term, ${formatNumber(topSearch.frequency)} searches so far`,
          },
        ]
      : []),
  ];
}

export default function AboutPage() {
  const site = useSite();
  const studioOperated = site.operator_name?.toUpperCase() === 'SUBCULT';
  const [summary, setSummary] = useState<ArchiveSummary | null>(null);
  const [factsUnavailable, setFactsUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api
      .getArchiveSummary(controller.signal)
      .then(setSummary)
      .catch(() => {
        if (!controller.signal.aborted) setFactsUnavailable(true);
      });
    return () => controller.abort();
  }, []);

  const faqs = [
    {
      question: `What is ${site.name}?`,
      answer: (
        <p>
          A searchable archive of {site.creator_name} broadcasts. Search a topic or an exact phrase
          and each result opens the source recording at that moment.
        </p>
      ),
    },
    {
      question: 'Who runs it, and is it official?',
      answer: (
        <>
          <p>{site.project_notice}</p>
          <p>
            The archive indexes public broadcasts for research, discovery and citation. Source
            creators retain their rights, and links point back to the original material.
          </p>
          {site.operator_name && (
            <p>
              Built by{' '}
              {site.operator_url ? (
                <a href={site.operator_url} className="action-link">
                  {site.operator_name}
                </a>
              ) : (
                site.operator_name
              )}
              .
            </p>
          )}
        </>
      ),
    },
    {
      question: 'Where do the transcripts come from?',
      answer: (
        <p>
          Speech recognition writes them automatically, so names and phrases can be wrong. Chapters
          and topic labels are generated too. The source, timestamps and surrounding transcript stay
          visible so you can check what was said.
        </p>
      ),
    },
    {
      question: 'Can I quote a search result?',
      answer: (
        <p>
          Treat a result as a lead, not a verdict. Open the timestamp, watch the recording, then
          cite the source.
        </p>
      ),
    },
    {
      question: 'Is every broadcast here?',
      answer: (
        <p>
          Coverage isn’t guaranteed. A broadcast appears once a public recording is available and
          has been transcribed, so some are late or missing.
        </p>
      ),
    },
    {
      question: 'Do I need an account?',
      answer: (
        <p>
          No. Search, transcripts and VOD pages are public. Signing in with Google or Twitch keeps
          your saved moments and searches in sync.
        </p>
      ),
    },
    {
      question: studioOperated ? 'Who pays for this?' : 'How can I support the archive?',
      answer: (
        <p>
          {studioOperated
            ? `The archive tools are maintained by SUBCULT, a studio that would welcome support from viewers like you. Contributions go to SUBCULT, not to ${site.creator_name}. `
            : 'Support is voluntary and the archive stays public either way. '}
          <Link to="/support" className="action-link">
            {studioOperated ? 'Support SUBCULT' : 'Support the archive'}
          </Link>
        </p>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="page-title">About {site.name}</h1>
        <Link to="/search" className="action-link text-sm font-semibold">
          Search the archive →
        </Link>
      </header>

      {!factsUnavailable && (
        <section aria-labelledby="about-facts" className="space-y-3">
          <div className="eyebrow-rule">
            <h2 id="about-facts">
              <span className="archive-eyebrow">By the numbers</span>
            </h2>
          </div>
          <ul className="fact-grid">
            {buildFacts(summary).map((fact) => (
              <li key={fact.caption} className="fact">
                <div className="fact-value">{fact.value}</div>
                <div className="mt-1 text-sm leading-5 text-muted">{fact.caption}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="about-faq" className="space-y-1">
        <div className="eyebrow-rule">
          <h2 id="about-faq">
            <span className="archive-eyebrow">Questions</span>
          </h2>
        </div>
        {faqs.map((faq) => (
          <details key={faq.question} className="faq-item">
            <summary>{faq.question}</summary>
            <div>{faq.answer}</div>
          </details>
        ))}
      </section>
    </div>
  );
}
