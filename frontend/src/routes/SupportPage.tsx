import { useSite } from '../services/site';
import { useEffect, useState } from 'react';
import { api } from '../services';
import type { SupportConfig } from '../types/api';

export default function SupportPage() {
  const site = useSite();
  const studioOperated = site.operator_name?.toUpperCase() === 'SUBCULT';
  const [config, setConfig] = useState<SupportConfig | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (studioOperated) return;
    let active = true;
    api
      .getSupportConfig()
      .then((next) => {
        if (active) setConfig(next);
      })
      .catch(() => {
        if (active) setUnavailable(true);
      });
    return () => {
      active = false;
    };
  }, [studioOperated]);
  const donationsEnabled = config?.donations_enabled && config.payment_url;
  return (
    <section className="archive-section mx-auto max-w-2xl space-y-4">
      <h1 className="page-title">{studioOperated ? 'Support SUBCULT' : `Support ${site.name}`}</h1>
      <p className="text-base leading-7 text-muted">
        {studioOperated
          ? `The archive tools are maintained by SUBCULT, a studio that would welcome support from viewers like you. Contributions go to SUBCULT, not to ${site.creator_name}.`
          : `A donation supports ${site.name}’s hosting and research infrastructure.`}
      </p>
      <p className="text-sm leading-6 text-muted">
        Support does not buy editorial influence, special access or content. The archive stays
        public whether you contribute or not.
        {donationsEnabled &&
          ` The button opens a Stripe-hosted checkout; ${site.name} does not collect or store your card number.`}
      </p>
      {studioOperated ? (
        <a href="https://subcult.tv/support" className="btn min-h-12 px-6">
          Support SUBCULT
        </a>
      ) : donationsEnabled ? (
        <a
          href={config.payment_url!}
          target="_blank"
          rel="noopener noreferrer"
          className="btn min-h-12 px-6"
        >
          Donate securely with Stripe ↗
        </a>
      ) : (
        <p className="text-sm text-muted" role="status">
          {unavailable
            ? 'Donation status is temporarily unavailable.'
            : config
              ? 'Donations are not open yet. The archive remains public.'
              : 'Checking donation status…'}
        </p>
      )}
    </section>
  );
}
