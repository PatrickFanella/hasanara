import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import PeriodVods from '../components/archive/PeriodVods';
import { api } from '../services';

afterEach(() => vi.restoreAllMocks());
it('paginates the whole broadcast range and retries a failed next page without losing results', async () => {
  const load = vi
    .spyOn(api, 'listStreamLibrary')
    .mockResolvedValueOnce({
      items: [{ id: 'first', youtube_id: 'a', title: 'First day' }],
      page_info: { has_next_page: true, next_cursor: 'next' },
    } as never)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({
      items: [{ id: 'last', youtube_id: 'b', title: 'Last day' }],
      page_info: { has_next_page: false },
    } as never);
  render(
    <MemoryRouter>
      <PeriodVods dateFrom="2025-06-01" dateTo="2025-06-30" />
    </MemoryRouter>
  );
  expect(await screen.findByText('First day')).toBeVisible();
  expect(load).toHaveBeenCalledWith(
    expect.objectContaining({
      date_from: '2025-06-01',
      date_to: '2025-06-30',
      date_field: 'broadcast_date',
    }),
    expect.any(AbortSignal)
  );
  fireEvent.click(screen.getByRole('button', { name: 'Load more VODs' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
  expect(screen.getByText('First day')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Retry VODs' }));
  expect(await screen.findByText('Last day')).toBeVisible();
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Load more VODs' })).not.toBeInTheDocument()
  );
  expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'next' }), undefined);
});
