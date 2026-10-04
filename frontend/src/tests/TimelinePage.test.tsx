import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimelinePage from '../routes/TimelinePage';
import { api } from '../services';
import { render } from '@testing-library/react';

describe('TimelinePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('links browse this period to the matching VODs date range', async () => {
    vi.spyOn(api, 'getTimeline').mockResolvedValue([
      {
        period: '2026-05',
        label: 'May 2026',
        video_count: 2,
        total_duration_seconds: 5400,
        videos: [
          {
            id: 'video-1',
            youtube_id: 'abc123',
            title: 'VOD one',
            channel_name: 'Channel Alpha',
            duration_seconds: 1800,
          },
        ],
      },
    ] as never);

    render(
      <MemoryRouter initialEntries={['/timeline']}>
        <TimelinePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Browse this period' })).toHaveAttribute(
        'href',
        '/episodes?date_from=2026-05-01&date_to=2026-05-31'
      );
    });
    expect(screen.getByText('2 VODs · 1:30:00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /VOD one/ })).toHaveAttribute('href', '/v/video-1');
  });

  it('distinguishes an unavailable timeline from a valid empty timeline', async () => {
    const timelineMock = vi
      .spyOn(api, 'getTimeline')
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce([] as never);

    const first = render(
      <MemoryRouter initialEntries={['/timeline']}>
        <TimelinePage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Timeline unavailable');
    expect(screen.queryByText('No timeline data yet.')).not.toBeInTheDocument();

    first.unmount();
    render(
      <MemoryRouter initialEntries={['/timeline']}>
        <TimelinePage />
      </MemoryRouter>
    );

    expect(await screen.findByText('No timeline data yet.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(timelineMock).toHaveBeenCalledTimes(2);
  });

  it('announces timeline loading before buckets arrive', () => {
    vi.spyOn(api, 'getTimeline').mockReturnValue(new Promise(() => {}) as never);

    render(
      <MemoryRouter initialEntries={['/timeline']}>
        <TimelinePage />
      </MemoryRouter>
    );

    expect(screen.getByText('Loading timeline…')).toBeInTheDocument();
    expect(screen.queryByText('No timeline data yet.')).not.toBeInTheDocument();
  });
});
