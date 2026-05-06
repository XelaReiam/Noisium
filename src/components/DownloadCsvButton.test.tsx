import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react';
import { DownloadCsvButton } from './DownloadCsvButton';
import { useAppStore } from '../store/useAppStore';

// ---------------------------------------------------------------------------
// Mock triggerDownload so jsdom Blob/URL.createObjectURL doesn't throw
// vi.hoisted ensures the mock fn is initialised before vi.mock hoisting.
// ---------------------------------------------------------------------------
const { mockTriggerDownload } = vi.hoisted(() => ({
  mockTriggerDownload: vi.fn(),
}));

vi.mock('../lib/exportCsv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/exportCsv')>();
  return {
    ...actual,
    triggerDownload: mockTriggerDownload,
  };
});

// ---------------------------------------------------------------------------
// Store helpers
// ---------------------------------------------------------------------------
function seedMeasuredStore() {
  // Two demos, both measured — canRevealWinner returns true
  act(() => {
    useAppStore.setState({
      demos: [
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Bravo' },
      ],
      scores: {
        a: { avgDbFs: -30, deltaDb: 8, capturedAt: '2026-05-06T00:00:00.000Z' },
        b: { avgDbFs: -25, deltaDb: 12, capturedAt: '2026-05-06T00:00:00.000Z' },
      },
      skippedDemoIds: [],
      sessionDate: '2026-05-06',
    });
  });
}

function seedUnmeasuredStore() {
  // No measured demos — canRevealWinner returns false
  act(() => {
    useAppStore.setState({
      demos: [{ id: 'a', name: 'Alpha' }],
      scores: {},
      skippedDemoIds: [],
      sessionDate: null,
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DownloadCsvButton', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().clearSession();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    useAppStore.getState().clearSession();
  });

  it('renders null when store has no measured demos (canReveal=false)', () => {
    seedUnmeasuredStore();
    const { container } = render(<DownloadCsvButton />);
    expect(container.firstChild).toBeNull();
  });

  it('renders "Download CSV" button when all non-skipped demos are measured (canReveal=true)', () => {
    seedMeasuredStore();
    render(<DownloadCsvButton />);
    expect(screen.getByRole('button', { name: /download csv/i })).toBeTruthy();
  });

  it('clicking the button calls triggerDownload', () => {
    seedMeasuredStore();
    render(<DownloadCsvButton />);
    const btn = screen.getByRole('button', { name: /download csv/i });
    fireEvent.click(btn);
    expect(mockTriggerDownload).toHaveBeenCalledTimes(1);
  });

  it('triggerDownload is called with the correct filename based on sessionDate', () => {
    seedMeasuredStore();
    render(<DownloadCsvButton />);
    fireEvent.click(screen.getByRole('button', { name: /download csv/i }));
    const [, filename] = mockTriggerDownload.mock.calls[0];
    expect(filename).toBe('noisium-results-2026-05-06.csv');
  });
});
