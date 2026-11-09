import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import * as siteService from '../services/site';
import axe from 'axe-core';
import SupportPage from '../routes/SupportPage';
import { api } from '../services';

afterEach(() => vi.restoreAllMocks());

const studioSite = {
  name: 'HasanAra',
  description: 'Broadcast archive',
  creator_name: 'HasanAbi',
  operator_name: 'Subcult',
  operator_url: 'https://subcult.tv',
  public_passages_enabled: true,
  community_enabled: false,
};

it('explains studio support without depending on donation configuration or offering checkout', async () => {
  vi.spyOn(siteService, 'useSite').mockReturnValue(studioSite);
  const config = vi.spyOn(api, 'getSupportConfig');
  const { container } = render(
    <MemoryRouter>
      <SupportPage />
    </MemoryRouter>
  );
  expect(screen.getByRole('link', { name: 'Support SUBCULT' })).toHaveAttribute(
    'href',
    'https://subcult.tv/support'
  );
  expect(screen.getByText(/Contributions go to SUBCULT, not to HasanAbi/)).toBeInTheDocument();
  expect(screen.queryByText(/Stripe|Donations are not open/)).not.toBeInTheDocument();
  expect(config).not.toHaveBeenCalled();
  expect((await axe.run(container)).violations).toEqual([]);
  config.mockRestore();
});

it('keeps client-owned donation destinations and identity independent from the studio', async () => {
  vi.spyOn(siteService, 'useSite').mockReturnValue({
    ...studioSite,
    name: 'Northstar Archive',
    creator_name: 'Northstar Studio',
    operator_name: 'Northstar Studio',
    operator_url: 'https://example.org',
  });
  vi.spyOn(api, 'getSupportConfig').mockResolvedValue({
    donations_enabled: true,
    payment_url: 'https://payments.example.org/northstar',
  });
  const { container } = render(
    <MemoryRouter>
      <SupportPage />
    </MemoryRouter>
  );
  expect(await screen.findByRole('link', { name: /Donate securely with Stripe/ })).toHaveAttribute(
    'href',
    'https://payments.example.org/northstar'
  );
  expect(container.textContent).not.toMatch(/HasanAra|HasanAbi|SUBCULT/i);
  expect(screen.getByText(/A donation supports Northstar Archive/)).toBeInTheDocument();
});
