import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axe from 'axe-core';
import FavoritesPage from '../routes/FavoritesPage';

const serviceMocks = vi.hoisted(() => ({
  user: null as null | { id: string },
  localMoments: [] as Array<{
    videoId: string;
    segIndex: number;
    startMs: number;
    endMs: number;
    text: string;
  }>,
  localSearches: [] as Array<{
    id: string;
    query: string;
    filters: Record<string, unknown>;
    created_at: string;
  }>,
  addFavorite: vi.fn(),
  createSavedSearch: vi.fn(),
  deleteFavorite: vi.fn(),
  deleteSavedSearch: vi.fn(),
  listFavorites: vi.fn(),
  listSavedSearches: vi.fn(),
  removeFavorite: vi.fn(),
  removeSavedSearch: vi.fn(),
  toggleFavorite: vi.fn(),
  addSavedSearch: vi.fn(),
}));

vi.mock('../services', () => ({
  useAuth: () => ({ user: serviceMocks.user }),
  favorites: {
    list: () => [...serviceMocks.localMoments],
    toggle: serviceMocks.toggleFavorite,
    remove: serviceMocks.removeFavorite,
  },
  localSavedSearches: {
    list: () => [...serviceMocks.localSearches],
    add: serviceMocks.addSavedSearch,
    remove: serviceMocks.removeSavedSearch,
  },
  savedSearchKey: (query: string, filters: Record<string, unknown>) =>
    JSON.stringify([
      query.trim(),
      filters.source ?? null,
      filters.category ?? null,
      filters.date_from ?? null,
      filters.date_to ?? null,
      filters.min_duration ?? null,
      filters.max_duration ?? null,
      filters.sort_by ?? null,
      filters.video_id ?? null,
      filters.limit ?? null,
      filters.offset ?? null,
    ]),
  apiAddFavorite: serviceMocks.addFavorite,
  apiCreateSavedSearch: serviceMocks.createSavedSearch,
  apiDeleteFavorite: serviceMocks.deleteFavorite,
  apiDeleteSavedSearch: serviceMocks.deleteSavedSearch,
  apiListFavorites: serviceMocks.listFavorites,
  apiListSavedSearches: serviceMocks.listSavedSearches,
}));

describe('FavoritesPage accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.user = null;
    serviceMocks.localMoments = [];
    serviceMocks.localSearches = [];
  });

  it('keeps anonymous saved moments and searches accessible', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/saved?q=rent']}>
        <FavoritesPage />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: 'Saved moments and searches' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('rent')).toBeInTheDocument();
    expect((await axe.run(container)).violations).toEqual([]);
  });

  it('migrates anonymous saves idempotently after sign-in', async () => {
    serviceMocks.user = { id: 'user-1' };
    serviceMocks.localMoments = [
      {
        videoId: 'video-1',
        segIndex: 1,
        startMs: 1_000,
        endMs: 2_000,
        text: 'Existing moment',
      },
      {
        videoId: 'video-2',
        segIndex: 2,
        startMs: 3_000,
        endMs: 4_000,
        text: 'New moment',
      },
    ];
    serviceMocks.localSearches = [
      {
        id: 'local:search-1',
        query: 'housing',
        filters: { source: 'best', category: 'politics' },
        created_at: '2026-08-06T00:00:00Z',
      },
    ];
    serviceMocks.listFavorites
      .mockResolvedValueOnce({
        items: [
          {
            id: 'remote-1',
            video_id: 'video-1',
            start_ms: 1_000,
            end_ms: 2_000,
            text: 'Existing moment',
          },
        ],
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'remote-1',
            video_id: 'video-1',
            start_ms: 1_000,
            end_ms: 2_000,
            text: 'Existing moment',
          },
          {
            id: 'remote-2',
            video_id: 'video-2',
            start_ms: 3_000,
            end_ms: 4_000,
            text: 'New moment',
          },
        ],
      });
    serviceMocks.addFavorite.mockResolvedValue({ id: 'remote-2' });
    serviceMocks.listSavedSearches
      .mockResolvedValueOnce({
        items: [
          {
            id: 'remote-search-1',
            query: 'housing',
            filters: { category: 'politics', source: 'best' },
            created_at: '2026-08-05T00:00:00Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'remote-search-1',
            query: 'housing',
            filters: { category: 'politics', source: 'best' },
            created_at: '2026-08-05T00:00:00Z',
          },
        ],
      });

    render(
      <MemoryRouter initialEntries={['/saved']}>
        <FavoritesPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(serviceMocks.listFavorites).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(serviceMocks.listSavedSearches).toHaveBeenCalledTimes(2));

    expect(serviceMocks.addFavorite).toHaveBeenCalledTimes(1);
    expect(serviceMocks.addFavorite).toHaveBeenCalledWith({
      video_id: 'video-2',
      start_ms: 3_000,
      end_ms: 4_000,
      text: 'New moment',
    });
    expect(serviceMocks.removeFavorite).toHaveBeenCalledTimes(2);
    expect(serviceMocks.createSavedSearch).not.toHaveBeenCalled();
    expect(serviceMocks.removeSavedSearch).toHaveBeenCalledWith('local:search-1');
  });
});
