import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Protected from '../routes/Protected';

const auth = vi.hoisted(() => ({ user: null as null | { id: string }, loading: true }));

vi.mock('../services', () => ({
  useAuth: () => ({ user: auth.user, loading: auth.loading, login: vi.fn() }),
}));

describe('Protected', () => {
  it('announces protected-route loading as a polite status', () => {
    render(
      <Protected>
        <p>Private content</p>
      </Protected>
    );

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status')).toHaveTextContent('Loading your account');
  });
});
