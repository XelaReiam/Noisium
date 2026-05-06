import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act, screen, fireEvent } from '@testing-library/react';
import { CalibrateButton } from './CalibrateButton';
import { useAppStore } from '../store/useAppStore';
import { getNoisiumChannel, resetNoisiumChannel } from '../lib/broadcastChannel';

// ---------------------------------------------------------------------------
// Mock useAudioEngine — provide a controllable engine
// ---------------------------------------------------------------------------
const mockCalibrateEngine = vi.fn();

vi.mock('../hooks/useAudioEngine', () => ({
  useAudioEngine: () => ({
    current: {
      calibrate: mockCalibrateEngine,
    },
  }),
}));

function getMockChannel() {
  return getNoisiumChannel() as unknown as {
    postMessage: ReturnType<typeof vi.fn>;
    _simulateMessage: (data: unknown) => void;
  };
}

function clickCalibrateButton() {
  const btn = screen.getByRole('button');
  fireEvent.click(btn);
}

describe('CalibrateButton — channel broadcasts (Phase 4)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetNoisiumChannel();
    useAppStore.getState().clearSession();
    vi.useFakeTimers();

    // Set up store so button is enabled
    act(() => {
      useAppStore.getState().setMicPermission('granted');
      useAppStore.getState().addDemo('TestDemo');
    });
  });

  afterEach(() => {
    cleanup();
    resetNoisiumChannel();
    vi.useRealTimers();
    vi.clearAllMocks();
    useAppStore.getState().clearSession();
  });

  it('(a) immediately broadcasts { phase: "calibrating" } on click', () => {
    // Calibrate never resolves during this test (we just check the click broadcast)
    mockCalibrateEngine.mockReturnValue(new Promise(() => {}));

    render(<CalibrateButton />);
    const ch = getMockChannel();
    ch.postMessage.mockClear();

    act(() => {
      clickCalibrateButton();
    });

    const calls = ch.postMessage.mock.calls.map((c) => c[0]);
    expect(calls).toContainEqual({ phase: 'calibrating' });
  });

  it('(b) broadcasts { phase: "idle" } after successful calibration + confirmation delay', async () => {
    mockCalibrateEngine.mockResolvedValue({ ambientDbFs: -50 });

    render(<CalibrateButton />);
    const ch = getMockChannel();

    act(() => {
      clickCalibrateButton();
    });
    ch.postMessage.mockClear();

    // Advance through 3s countdown + 0ms (engine resolves immediately after capture starts)
    await act(async () => {
      vi.advanceTimersByTime(3000);
      // Flush microtasks so the calibrate() promise resolves
      await Promise.resolve();
      await Promise.resolve();
    });

    // After calibrate resolves, we enter 'done' state and schedule a 1500ms timer
    // Advance through the CONFIRMATION_DURATION_MS = 1500ms
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    const calls = ch.postMessage.mock.calls.map((c) => c[0]);
    expect(calls).toContainEqual({ phase: 'idle' });
  });

  it('(c) broadcasts { phase: "idle" } immediately on calibration error', async () => {
    mockCalibrateEngine.mockRejectedValue(new Error('Mic lost'));

    render(<CalibrateButton />);
    const ch = getMockChannel();

    act(() => {
      clickCalibrateButton();
    });
    ch.postMessage.mockClear();

    // Advance through 3s countdown to start capture phase
    await act(async () => {
      vi.advanceTimersByTime(3000);
      // Flush microtasks so the rejected calibrate() promise is caught
      await Promise.resolve();
      await Promise.resolve();
    });

    // The idle broadcast should have been sent immediately in the catch block
    // (before any 2500ms timer advance)
    const calls = ch.postMessage.mock.calls.map((c) => c[0]);
    expect(calls).toContainEqual({ phase: 'idle' });
  });
});
