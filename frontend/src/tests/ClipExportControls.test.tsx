import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { HTTPError } from 'ky';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ClipExportControls from '../components/video/ClipExportControls';
import { http } from '../services/api';
vi.mock('../services', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

function renderControls() {
  return render(
    <StrictMode>
      <ClipExportControls videoId="video" range={{ startMs: 1500, endMs: 3000 }} />
    </StrictMode>
  );
}

it('automatically checks queued and running jobs and downloads exactly once on completion', async () => {
  vi.useFakeTimers();
  vi.spyOn(http, 'post').mockReturnValue({
    json: async () => ({ id: 'export', status: 'queued', expires_at: 1900000000 }),
  } as never);
  vi.spyOn(http, 'get')
    .mockReturnValueOnce({
      json: async () => ({ id: 'export', status: 'running', expires_at: 1900000000 }),
    } as never)
    .mockReturnValue({
      json: async () => ({ id: 'export', status: 'completed', expires_at: 1900000000 }),
    } as never);
  const view = renderControls();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Export and download' }));
  });
  expect(screen.getByText('Export queued.')).toBeInTheDocument();
  expect(http.post).toHaveBeenCalledWith('clips', {
    json: { video_id: 'video', start_ms: 1500, end_ms: 3000 },
  });
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(screen.getByText('Export running.')).toBeInTheDocument();
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(screen.getByRole('link', { name: 'Download MP4 again' })).toHaveAttribute(
    'href',
    '/api/clips/export/download'
  );
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  view.rerender(
    <StrictMode>
      <ClipExportControls videoId="video" range={{ startMs: 1500, endMs: 3000 }} />
    </StrictMode>
  );
  await act(() => vi.advanceTimersByTimeAsync(10000));
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  expect(http.get).toHaveBeenCalledTimes(2);
});

it('downloads cached results immediately and can request the same export again', async () => {
  vi.spyOn(http, 'post').mockReturnValue({
    json: async () => ({ id: 'cached', status: 'completed', expires_at: 1900000000 }),
  } as never);
  renderControls();
  fireEvent.click(screen.getByRole('button', { name: 'Export and download' }));
  await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Export and download' }));
  await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(2));
});

it('retries status failures automatically and cancels checks when closed', async () => {
  vi.useFakeTimers();
  vi.spyOn(http, 'post').mockReturnValue({
    json: async () => ({ id: 'export', status: 'queued', expires_at: 1900000000 }),
  } as never);
  vi.spyOn(http, 'get').mockReturnValue({
    json: async () => {
      throw new Error('offline');
    },
  } as never);
  const view = renderControls();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Export and download' }));
  });
  expect(screen.getByText('Export queued.')).toBeInTheDocument();
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(screen.getByRole('alert')).toHaveTextContent('Retrying automatically');
  view.unmount();
  await act(() => vi.advanceTimersByTimeAsync(10000));
  expect(http.get).toHaveBeenCalledTimes(1);
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
});

it.each(['failed', 'expired'])(
  'stops checking %s exports and allows regeneration',
  async (status) => {
    vi.spyOn(http, 'post').mockReturnValue({
      json: async () => ({ id: 'export', status, expires_at: 1 }),
    } as never);
    const get = vi.spyOn(http, 'get');
    renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'Export and download' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Export and download' })).toBeEnabled()
    );
    expect(get).not.toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  }
);

it('saves both range boundaries independently of the expiring media', async () => {
  vi.spyOn(http, 'post').mockReturnValue({ json: async () => ({ id: 'favorite' }) } as never);
  renderControls();
  fireEvent.click(screen.getByRole('button', { name: 'Save range' }));
  await screen.findByRole('button', { name: 'Range saved' });
  expect(http.post).toHaveBeenCalledWith('users/me/favorites', {
    json: { video_id: 'video', start_ms: 1500, end_ms: 3000, text: 'Clip 00:00:01.500–00:00:03' },
  });
  expect(screen.getByRole('link', { name: 'Saved moments' })).toHaveAttribute('href', '/saved');
});

it('blocks oversized selections and reports request errors', async () => {
  vi.spyOn(http, 'post').mockReturnValue({
    json: async () => {
      throw new Error('unavailable');
    },
  } as never);
  const view = render(<ClipExportControls videoId="video" range={{ startMs: 0, endMs: 120001 }} />);
  expect(screen.getByRole('button', { name: 'Export and download' })).toBeDisabled();
  view.rerender(<ClipExportControls videoId="video" range={{ startMs: 0, endMs: 1000 }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Export and download' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('source is available');
});

it('stops automatic checks when an export has been removed', async () => {
  vi.useFakeTimers();
  vi.spyOn(http, 'post').mockReturnValue({
    json: async () => ({ id: 'export', status: 'queued', expires_at: 1900000000 }),
  } as never);
  vi.spyOn(http, 'get').mockReturnValue({
    json: async () => {
      throw new HTTPError(
        new Response('', { status: 404 }),
        new Request('http://localhost/api/clips/export'),
        {} as never
      );
    },
  } as never);
  renderControls();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Export and download' }));
  });
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(screen.getByRole('alert')).toHaveTextContent('no longer available');
  expect(screen.getByRole('button', { name: 'Export and download' })).toBeEnabled();
  await act(() => vi.advanceTimersByTimeAsync(10000));
  expect(http.get).toHaveBeenCalledTimes(1);
});
