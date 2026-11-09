import { fireEvent, render, screen, within } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axe from 'axe-core';
import AppLayout from '../routes/AppLayout';
import * as siteService from '../services/site';

const auth = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  login: vi.fn(),
  loginTwitch: vi.fn(),
  logout: vi.fn(),
}));
const theme = vi.hoisted(() => ({ toggle: vi.fn() }));

vi.mock('../services', () => ({
  useAuth: () => ({
    user: auth.user,
    loading: false,
    login: auth.login,
    loginTwitch: auth.loginTwitch,
    logout: auth.logout,
  }),
  useTheme: () => ({ theme: 'dark', toggleTheme: theme.toggle }),
  api: {
    getExploreIntelligence: vi.fn().mockResolvedValue({
      topic_cards: [{ label: 'Gaza', total_moments: 12, recent_mentions_90d: 4 }],
      trending_searches: [{ term: 'labor', frequency: 3 }],
      summary: { popular_searches: [{ term: 'gaza', frequency: 9 }] },
    }),
  },
}));

describe('AppLayout navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = null;
  });
  it('keeps primary navigation focused on archive tasks', () => {
    const { container } = render(<AppLayout />, { wrapper: MemoryRouter });
    const navigation = within(screen.getByRole('navigation', { name: 'Main navigation' }));
    for (const [name, href] of [
      ['Home', '/'],
      ['Search', '/search'],
      ['Explore', '/explore'],
      ['VODs', '/episodes'],
      ['Saved', '/saved'],
    ]) {
      expect(navigation.getByRole('link', { name })).toHaveAttribute('href', href);
    }
    return axe.run(container).then((result) => expect(result.violations).toEqual([]));
  });

  it('shows trending archive topics on the wire as search links', async () => {
    render(<AppLayout />, { wrapper: MemoryRouter });
    const wire = screen.getByRole('region', { name: 'Trending in the archive' });
    const gaza = await within(wire).findAllByRole('link', { name: /Gaza/ });
    expect(gaza[0]).toHaveAttribute('href', '/search?q=Gaza');
    expect(gaza[0]).toHaveTextContent('4 mentions in 90 days');
    expect(within(wire).getAllByRole('link', { name: /labor/ })[0]).toHaveTextContent(
      'trending search'
    );
    // Duplicate popular terms collapse into the topic entry.
    expect(within(wire).getAllByRole('link', { name: /gaza/i })).toHaveLength(1);
  });

  it('hides The Wire with an icon control and remembers the choice', () => {
    render(<AppLayout />, { wrapper: MemoryRouter });
    const wire = screen.getByRole('region', { name: 'Trending in the archive' });
    expect(within(wire).getByText('The Wire')).toBeInTheDocument();

    fireEvent.click(within(wire).getByRole('button', { name: 'Hide The Wire' }));

    expect(wire).toHaveAttribute('data-visible', 'false');
    expect(within(wire).getByRole('button', { name: 'Show The Wire' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(localStorage.setItem).toHaveBeenCalledWith('hasanara:wire', 'hidden');
  });

  it('shows studio social links as labelled icons only for the SUBCULT operator', () => {
    const site = siteService.useSite;
    const spy = vi.spyOn(siteService, 'useSite');
    spy.mockImplementation(() => ({ ...site(), operator_name: 'Subcult' }));
    const { unmount } = render(<AppLayout />, { wrapper: MemoryRouter });
    const footer = within(screen.getByRole('contentinfo'));
    for (const [name, href] of [
      ['SUBCULT on Bluesky', 'https://bsky.app/profile/subcult.tv'],
      ['SUBCULT on Instagram', 'https://www.instagram.com/subcult.tv/'],
      ['SUBCULT on X', 'https://x.com/subcult_tv'],
    ]) {
      const link = footer.getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveTextContent('');
    }
    unmount();

    spy.mockImplementation(() => ({ ...site(), operator_name: 'Northstar Studio' }));
    render(<AppLayout />, { wrapper: MemoryRouter });
    expect(
      within(screen.getByRole('contentinfo')).queryByRole('link', { name: /Bluesky/ })
    ).not.toBeInTheDocument();
    spy.mockRestore();
  });

  it('links the public project and legal pages from the footer', () => {
    render(<AppLayout />, { wrapper: MemoryRouter });

    for (const [name, href] of [
      ['About', '/about'],
      ['Privacy', '/privacy'],
      ['Terms', '/terms'],
      ['Support', '/support'],
    ]) {
      expect(within(screen.getByRole('contentinfo')).getByRole('link', { name })).toHaveAttribute(
        'href',
        href
      );
    }
  });

  it('only renders the mobile menu while open and restores focus on Escape', () => {
    render(<AppLayout />, { wrapper: MemoryRouter });
    const button = screen.getByRole('button', { name: 'Open menu' });
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('exposes Account navigation only to authenticated users in desktop and mobile navigation', () => {
    auth.user = { id: 'user-1', email: 'person@example.com' };
    render(<AppLayout />, { wrapper: MemoryRouter });
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account');
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(
      within(screen.getByRole('navigation', { name: 'Mobile navigation' })).getByRole('link', {
        name: 'Account',
      })
    ).toHaveAttribute('href', '/account');
  });

  it('marks the current destination and moves keyboard focus with the skip link', () => {
    render(
      <MemoryRouter initialEntries={['/search']}>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toContainElement(
      screen.getByRole('link', { name: 'Search', current: 'page' })
    );
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content'
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    fireEvent.click(screen.getByRole('link', { name: 'Skip to main content' }));
    return new Promise<void>((resolve) =>
      requestAnimationFrame(() => {
        expect(screen.getByRole('main')).toHaveFocus();
        resolve();
      })
    );
  });

  it('does not steal focus when a user reaches a control during a route transition', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route
              index
              element={
                <>
                  <h1>Home</h1>
                  <Link to="/search">Open search</Link>
                </>
              }
            />
            <Route
              path="search"
              element={
                <>
                  <h1>Search</h1>
                  <input aria-label="Search query" />
                </>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('link', { name: 'Open search' }));
    const query = screen.getByRole('textbox', { name: 'Search query' });
    query.focus();

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(query).toHaveFocus();
  });

  it('marks the current destination in mobile navigation', () => {
    render(
      <MemoryRouter initialEntries={['/explore']}>
        <AppLayout />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = screen.getByRole('navigation', { name: 'Mobile navigation' });
    expect(within(menu).getByRole('link', { name: 'Explore', current: 'page' })).toBeVisible();
  });

  it('changes theme from mobile navigation without closing the menu', () => {
    render(<AppLayout />, { wrapper: MemoryRouter });
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = screen.getByRole('navigation', { name: 'Mobile navigation' });

    fireEvent.click(within(menu).getByRole('button', { name: 'Light mode' }));

    expect(theme.toggle).toHaveBeenCalledOnce();
    expect(menu).toBeInTheDocument();
  });

  it('starts anonymous mobile sign-in and closes the menu', () => {
    render(<AppLayout />, { wrapper: MemoryRouter });
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Mobile navigation' })).getByRole('button', {
        name: 'Google',
      })
    );

    expect(auth.login).toHaveBeenCalledOnce();
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
  });

  it('logs an authenticated mobile user out and closes the menu', () => {
    auth.user = { id: 'user-1', email: 'person@example.com' };
    render(<AppLayout />, { wrapper: MemoryRouter });
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Mobile navigation' })).getByRole('button', {
        name: 'Logout',
      })
    );

    expect(auth.logout).toHaveBeenCalledOnce();
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
  });
});
