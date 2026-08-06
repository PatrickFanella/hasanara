import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import type { ArchiveLabelAssignmentResponse, ArchiveLabelResponse } from '../types/api';

function mockJsonResponse<T>(value: T) {
  return {
    json: () => Promise.resolve(value),
  };
}

function requestUrl(value: unknown): string {
  return String(value);
}

function requestJson(value: unknown): Record<string, unknown> {
  return (value as { json?: Record<string, unknown> } | undefined)?.json ?? {};
}

function requestSearchParams(value: unknown): URLSearchParams | undefined {
  return (value as { searchParams?: URLSearchParams } | undefined)?.searchParams;
}

function rejectedResponse(message: string) {
  return { json: () => Promise.reject(new Error(message)) };
}

vi.mock('../services/api', () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { http } from '../services/api';
import AdminLabelIntelligence from '../routes/admin/AdminLabelIntelligence';

describe('AdminLabelIntelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders candidate labels, reviews assignments, reviews labels, and triggers extraction', async () => {
    let labels: ArchiveLabelResponse[] = [
      {
        id: 'label-1',
        slug: 'union-news',
        label: 'Union News',
        kind: 'topic',
        status: 'candidate',
        source: 'automatic',
        publish_tier: 'shadow',
        confidence_score: 0.91,
        description: 'Labor organizing coverage',
      },
      {
        id: 'label-2',
        slug: 'gaming',
        label: 'Gaming',
        kind: 'category',
        status: 'candidate',
        source: 'automatic',
        publish_tier: 'shadow',
        confidence_score: 0.83,
        description: null,
      },
    ];
    let assignments: ArchiveLabelAssignmentResponse[] = [
      {
        id: 'assignment-1',
        label: labels[0],
        video_id: 'video-1',
        unit_type: 'window',
        start_ms: 120000,
        end_ms: 150000,
        status: 'candidate',
        publish_tier: 'shadow',
        confidence_score: 0.88,
        evidence_count: 1,
        evidence: [{ text: 'workers voted to unionize' }],
      },
    ];

    vi.mocked(http.get).mockImplementation((url: unknown) => {
      if (requestUrl(url) === 'admin/archive/labels') {
        return mockJsonResponse({ items: labels }) as never;
      }
      if (requestUrl(url) === 'admin/archive/labels/label-1/assignments') {
        return mockJsonResponse({ items: assignments }) as never;
      }
      if (requestUrl(url) === 'admin/archive/labels/label-2/assignments') {
        return mockJsonResponse({ items: [] }) as never;
      }
      return mockJsonResponse({ items: [] }) as never;
    });

    vi.mocked(http.post).mockImplementation((url: unknown, options?: unknown) => {
      const action = String(requestJson(options).action ?? '');
      if (requestUrl(url) === 'admin/archive/label-assignments/assignment-1/review') {
        assignments = assignments.map((assignment) =>
          assignment.id === 'assignment-1'
            ? {
                ...assignment,
                status: action === 'approve' ? 'admin_approved' : action,
                label: {
                  ...assignment.label,
                  status: action === 'approve' ? 'published' : assignment.label.status,
                },
              }
            : assignment
        );
        return mockJsonResponse(assignments[0]) as never;
      }

      if (requestUrl(url) === 'admin/archive/labels/label-1/review') {
        const updated = {
          ...labels[0],
          status: action === 'publish' || action === 'approve' ? 'published' : action,
        };
        labels = labels.map((label) => (label.id === 'label-1' ? updated : label));
        return mockJsonResponse(updated) as never;
      }

      if (requestUrl(url) === 'admin/archive/labels/extract-video/video-99') {
        return mockJsonResponse({
          video_id: 'video-99',
          extraction_tier: 'balanced',
          run_id: 'run-1',
          windows: 2,
          candidates: 4,
          assignments: 6,
        }) as never;
      }

      return mockJsonResponse({ ok: true }) as never;
    });

    render(
      <BrowserRouter>
        <AdminLabelIntelligence />
      </BrowserRouter>
    );

    expect(await screen.findByText('Label intelligence')).toBeInTheDocument();
    expect((await screen.findAllByText('Union News')).length).toBeGreaterThan(0);
    expect(screen.getByText('Gaming')).toBeInTheDocument();
    expect(await screen.findByText('Labor organizing coverage')).toBeInTheDocument();
    expect(await screen.findByText('workers voted to unionize')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /window/i })).toHaveAttribute(
      'href',
      '/v/video-1?t=120'
    );

    const user = userEvent.setup();
    const evidenceRows = screen.getByRole('table');
    await user.click(within(evidenceRows).getByRole('button', { name: 'approve' }));

    await waitFor(() => {
      expect(vi.mocked(http.post)).toHaveBeenCalledWith(
        'admin/archive/label-assignments/assignment-1/review',
        expect.objectContaining({ json: { action: 'approve' } })
      );
    });
    expect(await screen.findByText('approve applied to assignment.')).toBeInTheDocument();
    expect(screen.getByText('admin_approved')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'publish' })[0]);
    await waitFor(() => {
      expect(vi.mocked(http.post)).toHaveBeenCalledWith(
        'admin/archive/labels/label-1/review',
        expect.objectContaining({ json: { action: 'publish' } })
      );
    });
    expect(await screen.findByText('publish applied to Union News.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Video ID'), 'video-99');
    await user.selectOptions(screen.getByLabelText('Tier'), 'balanced');
    await user.click(screen.getByRole('button', { name: 'Extract labels' }));

    await waitFor(() => {
      expect(vi.mocked(http.post)).toHaveBeenCalledWith(
        'admin/archive/labels/extract-video/video-99',
        expect.objectContaining({ searchParams: { extraction_tier: 'balanced' } })
      );
    });
    expect(
      await screen.findByText('Extraction queued for video-99: 4 candidates, 6 assignments.')
    ).toBeInTheDocument();
  });

  it('filters candidate labels by status, kind, and query', async () => {
    const label: ArchiveLabelResponse = {
      id: 'label-2',
      slug: 'gaming',
      label: 'Gaming',
      kind: 'category',
      status: 'published',
      source: 'automatic',
      publish_tier: 'shadow',
      confidence_score: 0.83,
      description: null,
    };
    vi.mocked(http.get).mockImplementation((url: unknown) => {
      if (requestUrl(url) === 'admin/archive/labels') {
        return mockJsonResponse({ items: [label] }) as never;
      }
      return mockJsonResponse({ items: [] }) as never;
    });

    render(
      <BrowserRouter>
        <AdminLabelIntelligence />
      </BrowserRouter>
    );
    expect((await screen.findAllByText('Gaming')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Status'), 'published');
    await user.selectOptions(screen.getByLabelText('Kind'), 'category');
    await user.type(screen.getByLabelText('Search labels'), 'gaming');

    await waitFor(() => {
      const labelCalls = vi
        .mocked(http.get)
        .mock.calls.filter(([url]) => requestUrl(url) === 'admin/archive/labels');
      const params = requestSearchParams(labelCalls.at(-1)?.[1]);
      expect(Object.fromEntries(params ?? [])).toEqual({
        status: 'published',
        kind: 'category',
        q: 'gaming',
        limit: '100',
        offset: '0',
      });
    });
  });

  it('announces label and assignment mutation failures without optimistic state', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const label: ArchiveLabelResponse = {
      id: 'label-1',
      slug: 'union-news',
      label: 'Union News',
      kind: 'topic',
      status: 'candidate',
      source: 'automatic',
      publish_tier: 'shadow',
      confidence_score: 0.91,
      description: 'Labor organizing coverage',
    };
    const assignment: ArchiveLabelAssignmentResponse = {
      id: 'assignment-1',
      label,
      video_id: 'video-1',
      unit_type: 'window',
      start_ms: 120_000,
      end_ms: 150_000,
      status: 'candidate',
      publish_tier: 'shadow',
      confidence_score: 0.88,
      evidence_count: 1,
      evidence: [{ text: 'workers voted to unionize' }],
    };
    vi.mocked(http.get).mockImplementation((url: unknown) => {
      if (requestUrl(url) === 'admin/archive/labels') {
        return mockJsonResponse({ items: [label] }) as never;
      }
      if (requestUrl(url) === 'admin/archive/labels/label-1/assignments') {
        return mockJsonResponse({ items: [assignment] }) as never;
      }
      return mockJsonResponse({ items: [] }) as never;
    });
    vi.mocked(http.post).mockImplementation(() => rejectedResponse('offline') as never);

    render(
      <BrowserRouter>
        <AdminLabelIntelligence />
      </BrowserRouter>
    );
    const evidenceRows = await screen.findByRole('table');
    const publish = screen.getAllByRole('button', { name: 'publish' })[0];
    await userEvent.click(publish);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to publish label.');
    expect(screen.getAllByText('candidate').length).toBeGreaterThan(0);
    expect(screen.queryByText('publish applied to Union News.')).not.toBeInTheDocument();

    await userEvent.click(within(evidenceRows).getByRole('button', { name: 'approve' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to approve assignment.');
    expect(within(evidenceRows).getByText('candidate')).toBeInTheDocument();
    expect(screen.queryByText('approve applied to assignment.')).not.toBeInTheDocument();
  });
});
