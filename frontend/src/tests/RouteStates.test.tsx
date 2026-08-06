import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { NotFoundPage, RouteErrorPage } from '../routes/RouteStates';

describe('route recovery states', () => {
  it('lets a visitor recover from an unknown route', () => {
    render(
      <MemoryRouter initialEntries={['/missing']}>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');
  });

  it('exposes retry and home recovery after a route exception', async () => {
    const reload = vi.fn();
    const originalReload = window.location.reload;
    Object.defineProperty(window.location, 'reload', { configurable: true, value: reload });
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <div>Home</div>,
          errorElement: <RouteErrorPage />,
          loader: () => {
            throw new Error('Archive route failed');
          },
        },
      ],
      { initialEntries: ['/'] }
    );

    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('heading', { name: 'Something interrupted this page' })
    ).toBeInTheDocument();
    expect(screen.getByText('Archive route failed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(reload).toHaveBeenCalledOnce();

    Object.defineProperty(window.location, 'reload', {
      configurable: true,
      value: originalReload,
    });
  });
});
