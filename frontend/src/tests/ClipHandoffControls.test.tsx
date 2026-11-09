import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HTTPError } from 'ky';
import { beforeEach, expect, it, vi } from 'vitest';
import ClipHandoffControls from '../components/video/ClipHandoffControls';
import { http } from '../services/api';
import fixture from './fixtures/clip-handoff.v1.json';

const raw = JSON.stringify(fixture);
const props = {
  jobId: fixture.export_id,
  videoId: fixture.recording.video_id,
  range: { startMs: fixture.passage.start_ms, endMs: fixture.passage.end_ms },
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:handoff');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.mocked(navigator.clipboard.writeText).mockReset().mockResolvedValue(undefined);
  vi.spyOn(http, 'get').mockReturnValue({ text: async () => raw } as never);
});

function setup() {
  const onUnavailable = vi.fn();
  const view = render(<ClipHandoffControls {...props} onUnavailable={onUnavailable} />);
  return { ...view, onUnavailable };
}

it('downloads the producer document intact, including caption cues and immutable provenance', async () => {
  const { unmount } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Download handoff JSON (v1)' }));
  const input = await screen.findByRole('textbox', { name: 'Handoff JSON' });
  expect(input).toHaveValue(raw);
  const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
  expect(await blob.text()).toBe(raw);
  expect(blob.type).toBe('application/json');
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Transcript: whisper, revision/)).toHaveTextContent(
    fixture.transcript.revision_sha256
  );
  expect(screen.getByText(/Some cues have no supported end time/)).toBeInTheDocument();
  const link = screen.getByRole('link', { name: 'Open clpr draft importer' });
  expect(link).toHaveAttribute('href', 'https://clpr.tv/submit');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(screen.getByText(/Nothing is submitted or published/)).toBeInTheDocument();
  expect(http.get).toHaveBeenCalledWith(`clips/${fixture.export_id}/handoff`, {
    signal: expect.any(AbortSignal),
  });
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:handoff');
});

it('copies the exact JSON and offers a keyboard fallback when clipboard permission is denied', async () => {
  setup();
  vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
  fireEvent.click(screen.getByRole('button', { name: 'Copy handoff JSON' }));
  expect(await screen.findByText(/Select and copy the handoff JSON below/)).toBeInTheDocument();
  const input = screen.getByRole('textbox', { name: 'Handoff JSON' }) as HTMLTextAreaElement;
  fireEvent.focus(input);
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(raw.length);
  expect(input.readOnly).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Copy handoff JSON' }));
  await screen.findByText(/Handoff JSON copied/);
  expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(raw);
  expect(http.get).toHaveBeenCalledTimes(2);
});

it('keeps the JSON copy fallback when a browser download fails', async () => {
  setup();
  vi.mocked(URL.createObjectURL).mockImplementation(() => {
    throw new Error('download failed');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Download handoff JSON (v1)' }));
  expect(await screen.findByText(/Select and copy the handoff JSON below/)).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Handoff JSON' })).toHaveValue(raw);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it.each([401, 403, 404])(
  'clears prior handoffs on ownership, expiry, deletion, disabled or revocation failure (%s)',
  async (status) => {
    const { onUnavailable } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Copy handoff JSON' }));
    await screen.findByRole('textbox', { name: 'Handoff JSON' });
    vi.mocked(http.get).mockReturnValue({
      text: async () => {
        throw new HTTPError(
          new Response('', { status }),
          new Request('https://archive.example/api/clips/export/handoff'),
          {} as never
        );
      },
    } as never);
    fireEvent.click(screen.getByRole('button', { name: 'Copy handoff JSON' }));
    await waitFor(() => expect(onUnavailable).toHaveBeenCalledOnce());
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
  }
);

it('reports legacy exports and lets a failed handoff request be retried', async () => {
  setup();
  vi.mocked(http.get).mockReturnValueOnce({
    text: async () => {
      throw new HTTPError(
        new Response('', { status: 409 }),
        new Request('https://archive.example/api/clips/export/handoff'),
        {} as never
      );
    },
  } as never);
  fireEvent.click(screen.getByRole('button', { name: 'Copy handoff JSON' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('no captured provenance');
  fireEvent.click(screen.getByRole('button', { name: 'Copy handoff JSON' }));
  await screen.findByText(/Handoff JSON copied/);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('reports transport failures without copying or requesting a download', async () => {
  setup();
  vi.mocked(http.get).mockReturnValueOnce({
    text: async () => {
      throw new Error('offline');
    },
  } as never);
  fireEvent.click(screen.getByRole('button', { name: 'Download handoff JSON (v1)' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the handoff');
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
});

it.each(['version', 'range'])(
  'rejects an unexpected %s without handing off another export',
  async (change) => {
    setup();
    vi.mocked(http.get).mockReturnValueOnce({
      text: async () =>
        JSON.stringify({
          ...fixture,
          ...(change === 'version'
            ? { schema_version: 2 }
            : { passage: { ...fixture.passage, end_ms: 765000 } }),
        }),
    } as never);
    fireEvent.click(screen.getByRole('button', { name: 'Copy handoff JSON' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the handoff');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  }
);

it.each(['unavailable', 'empty', 'shortened'])(
  'explains %s captions without inventing timing',
  async (kind) => {
    setup();
    const next = structuredClone(fixture);
    if (kind === 'unavailable')
      Object.assign(next, {
        transcript: { status: 'unavailable' },
        captions: { timing: 'unavailable', cues: [], cues_truncated: false, text_sha256: null },
      });
    if (kind === 'empty') next.captions.cues = [];
    if (kind === 'shortened') next.captions.cues_truncated = true;
    vi.mocked(http.get).mockReturnValueOnce({ text: async () => JSON.stringify(next) } as never);
    fireEvent.click(screen.getByRole('button', { name: 'Copy handoff JSON' }));
    await screen.findByRole('textbox');
    expect(
      screen.getByText(
        kind === 'unavailable'
          ? /Caption timing is unavailable or unsupported/
          : kind === 'empty'
            ? /No caption cues overlap/
            : /producer shortened the captions/
      )
    ).toBeInTheDocument();
  }
);

it('does not transfer a late response after a range change closes the handoff', async () => {
  let complete!: (value: string) => void;
  const response = new Promise<string>((resolve) => {
    complete = resolve;
  });
  vi.mocked(http.get).mockReturnValue({ text: () => response } as never);
  const { unmount } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Copy handoff JSON' }));
  unmount();
  await act(async () => complete(raw));
  expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
});

it('reports a malformed caption payload without crashing the passage editor', async () => {
  setup();
  vi.mocked(http.get).mockReturnValueOnce({
    text: async () =>
      JSON.stringify({ ...fixture, captions: { timing: 'clip-relative', cues: [null] } }),
  } as never);
  fireEvent.click(screen.getByRole('button', { name: 'Copy handoff JSON' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the handoff');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
});
