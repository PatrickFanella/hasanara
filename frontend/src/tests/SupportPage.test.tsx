import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import axe from 'axe-core';
import SupportPage from '../routes/SupportPage';
import { api } from '../services';

it('explains studio support without depending on donation configuration or offering checkout', async () => {
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
  expect(screen.getByText(/Contributions go to SUBCULT, not HasanAbi/)).toBeInTheDocument();
  expect(screen.queryByText(/Stripe|Donations are not open/)).not.toBeInTheDocument();
  expect(config).not.toHaveBeenCalled();
  expect((await axe.run(container)).violations).toEqual([]);
  config.mockRestore();
});
