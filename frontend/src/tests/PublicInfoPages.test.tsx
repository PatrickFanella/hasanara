import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import axe from 'axe-core';
import AboutPage from '../routes/AboutPage';
import { PrivacyPage, TermsPage } from '../routes/PolicyPages';
import { api } from '../services';

describe('public project pages', () => {
  it('answers common questions and derives facts from the live archive', async () => {
    vi.spyOn(api, 'getArchiveSummary').mockResolvedValue({
      video_count: 3034,
      total_duration_seconds: 61047924,
      transcript_word_count: 178626646,
      popular_searches: [{ term: 'trump', frequency: 196 }],
    } as never);
    const { container } = render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: /^About / })).toBeInTheDocument();
    expect(await screen.findByText('706 days')).toBeInTheDocument();
    expect(screen.getByText('178.6M words')).toBeInTheDocument();
    expect(screen.getByText('5h 35m')).toBeInTheDocument();
    expect(screen.getByText('Who runs it, and is it official?')).toBeInTheDocument();
    expect(screen.getByText('Is every broadcast here?')).toBeInTheDocument();
    expect(screen.getByText(/Source recordings and trademarks belong/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Search the archive/ })).toHaveAttribute(
      'href',
      '/search'
    );
    expect((await axe.run(container)).violations).toEqual([]);
  });

  it('keeps the questions when archive facts cannot load', async () => {
    vi.spyOn(api, 'getArchiveSummary').mockRejectedValue(new Error('unavailable'));
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.queryByText('By the numbers')).not.toBeInTheDocument());
    expect(screen.getByText('Do I need an account?')).toBeInTheDocument();
  });

  it('publishes privacy and donation terms before accepting support', () => {
    const { unmount } = render(<PrivacyPage />, { wrapper: MemoryRouter });
    expect(screen.getByRole('heading', { name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getByText(/Stripe receives payment information/i)).toBeInTheDocument();
    unmount();

    render(<TermsPage />, { wrapper: MemoryRouter });
    expect(screen.getByRole('heading', { name: 'Terms' })).toBeInTheDocument();
    expect(screen.getByText(/donations are voluntary/i)).toBeInTheDocument();
  });
});
