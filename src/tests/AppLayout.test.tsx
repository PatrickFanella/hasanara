import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axe from 'axe-core';
import AppLayout from '../routes/AppLayout';

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
}));

describe('AppLayout navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = null;
  });
  it('includes Timeline in primary navigation', () => {
    const { container } = render(<AppLayout />, { wrapper: MemoryRouter });
    for (const [name, href] of [
      ['Home', '/'],
      ['Search', '/search'],
      ['Explore', '/explore'],
      ['Timeline', '/timeline'],
      ['VODs', '/episodes'],
      ['Saved', '/saved'],
    ]) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
    }
    return axe.run(container).then((result) => expect(result.violations).toEqual([]));
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

  it('marks the current destination and exposes a working skip link', () => {
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
