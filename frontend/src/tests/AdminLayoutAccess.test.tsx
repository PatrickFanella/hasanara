import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '../routes/admin/AdminLayout';

const auth = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'user@example.com' } as { id: string; email: string } | null,
  loading: false,
  capabilities: [] as string[],
}));

vi.mock('../services/auth', () => ({ useAuth: () => auth }));
vi.mock('../services', () => ({ useAuth: () => auth }));

describe('AdminLayout access', () => {
  beforeEach(() => {
    auth.user = { id: 'user-1', email: 'user@example.com' };
    auth.loading = false;
    auth.capabilities = [];
  });

  it('renders a 403 state without loading admin children for non-admin users', () => {
    render(<AdminLayout />, { wrapper: MemoryRouter });
    expect(screen.getByText('Admin access required')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('renders the admin shell only with the admin capability', () => {
    auth.capabilities = ['admin:access'];
    render(<AdminLayout />, { wrapper: MemoryRouter });
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/admin/dashboard'
    );
    expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute('href', '/admin/events');
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/admin/users');
    expect(screen.getByRole('link', { name: 'Periods' })).toHaveAttribute('href', '/admin/periods');
    expect(screen.getByRole('link', { name: 'Metadata' })).toHaveAttribute(
      'href',
      '/admin/metadata'
    );
    expect(screen.getByRole('link', { name: 'Labels' })).toHaveAttribute('href', '/admin/labels');
  });

  it('requires anonymous visitors to sign in before admin content renders', () => {
    auth.user = null;
    render(<AdminLayout />, { wrapper: MemoryRouter });

    expect(screen.getByRole('heading', { name: 'Sign in required' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });
});
