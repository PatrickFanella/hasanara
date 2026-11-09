import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { HTTPError } from 'ky';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ClipExportControls from '../components/video/ClipExportControls';
import { http } from '../services/api';
const auth = vi.hoisted(() => ({ user: { id: 'owner' } as { id: string } | null }));
vi.mock('../services', () => ({ useAuth: () => auth }));
beforeEach(() => {
  vi.restoreAllMocks();
  auth.user = { id: 'owner' };
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mp4');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(http, 'get').mockReturnValue({
    blob: async () => new Blob(['mp4'], { type: 'video/mp4' }),
  } as never);
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
    .mockReturnValueOnce({
      json: async () => ({ id: 'export', status: 'completed', expires_at: 1900000000 }),
    } as never);
  const view = renderControls();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Export and download' }));
  });
  expect(screen.getByText('Export queued.')).toBeInTheDocument();
  expect(http.post).toHaveBeenCalledWith('clips', {
    json: { video_id: 'video', start_ms: 1500, end_ms: 3000 },
    signal: expect.any(AbortSignal),
  });
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(screen.getByText('Export running.')).toBeInTheDocument();
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(screen.getByRole('button', { name: 'Download MP4 again' })).toBeEnabled();
  expect(http.get).toHaveBeenCalledWith('clips/export/download', {
    signal: expect.any(AbortSignal),
    timeout: false,
  });
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  view.rerender(
    <StrictMode>
      <ClipExportControls videoId="video" range={{ startMs: 1500, endMs: 3000 }} />
    </StrictMode>
  );
  await act(() => vi.advanceTimersByTimeAsync(10000));
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  expect(http.get).toHaveBeenCalledTimes(3);
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
    expect(screen.queryByLabelText('clpr handoff')).not.toBeInTheDocument();
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

it('discards completed exports and saved state when the selected range or account changes', async () => {
  vi.spyOn(http, 'post').mockReturnValue({
    json: async () => ({ id: 'cached', status: 'completed', expires_at: 1900000000 }),
  } as never);
  const view = renderControls();
  fireEvent.click(screen.getByRole('button', { name: 'Export and download' }));
  await screen.findByRole('button', { name: 'Download handoff JSON (v1)' });
  view.rerender(<ClipExportControls videoId="video" range={{ startMs: 3000, endMs: 4000 }} />);
  expect(screen.queryByLabelText('clpr handoff')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Download MP4 again' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Export and download' }));
  await screen.findByRole('button', { name: 'Download handoff JSON (v1)' });
  auth.user = { id: 'another-account' };
  view.rerender(<ClipExportControls videoId="video" range={{ startMs: 3000, endMs: 4000 }} />);
  expect(screen.queryByLabelText('clpr handoff')).not.toBeInTheDocument();
  auth.user = null;
  view.rerender(<ClipExportControls videoId="video" range={{ startMs: 3000, endMs: 4000 }} />);
  expect(screen.getByText('Sign in to save ranges and download clips.')).toBeInTheDocument();
});

it('ignores a completed request for a range which has since changed', async () => {
  let complete!: (value: unknown) => void;
  const response = new Promise((resolve) => {
    complete = resolve;
  });
  vi.spyOn(http, 'post').mockReturnValue({ json: () => response } as never);
  const view = renderControls();
  fireEvent.click(screen.getByRole('button', { name: 'Export and download' }));
  view.rerender(<ClipExportControls videoId="video" range={{ startMs: 3000, endMs: 4000 }} />);
  await act(async () => {
    complete({ id: 'old', status: 'completed', expires_at: 1900000000 });
  });
  expect(screen.queryByLabelText('clpr handoff')).not.toBeInTheDocument();
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
});

it('removes completed media and handoff actions at expiry without a reload', async () => {
  vi.useFakeTimers();
  vi.spyOn(http, 'post').mockReturnValue({
    json: async () => ({ id: 'cached', status: 'completed', expires_at: Date.now() / 1000 + 10 }),
  } as never);
  renderControls();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Export and download' }));
  });
  expect(screen.getByLabelText('clpr handoff')).toBeInTheDocument();
  await act(() => vi.advanceTimersByTimeAsync(10000));
  expect(screen.queryByLabelText('clpr handoff')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Download MP4 again' })).not.toBeInTheDocument();
  expect(
    screen.getByText('Server copy expired. Export again to regenerate it.')
  ).toBeInTheDocument();
});

it('recovers from failed MP4 downloads while keeping the handoff available', async () => {
  vi.spyOn(http, 'post').mockReturnValue({
    json: async () => ({ id: 'cached', status: 'completed', expires_at: 1900000000 }),
  } as never);
  vi.mocked(http.get).mockReturnValueOnce({
    blob: async () => {
      throw new Error('offline');
    },
  } as never);
  renderControls();
  fireEvent.click(screen.getByRole('button', { name: 'Export and download' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not download the MP4');
  expect(screen.getByLabelText('clpr handoff')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Download MP4 again' }));
  await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
