import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act, screen, fireEvent } from '@testing-library/react';
import { CalibrateButton } from './CalibrateButton';
import { useAppStore } from '../store/useAppStore';

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

function clickCalibrateButton() {
  const btn = screen.getByRole('button');
  fireEvent.click(btn);
}

describe('CalibrateButton — store-driven broadcast (Phase 5)', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().clearSession();
    vi.useFakeTimers();

    // Set up store so button is enabled — no addDemo needed (TD-2 removed)
    act(() => {
      useAppStore.getState().setMicPermission('granted');
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    useAppStore.getState().clearSession();
  });

  it('button is enabled with zero demos when micPermission === "granted"', () => {
    render(<CalibrateButton />);
    const btn = screen.getByRole('button');
    // Documents TD-2 removal — zero demos, no addDemo, still enabled
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('(a) immediately sets measurePhase to "calibrating" on click', () => {
    // Calibrate never resolves during this test (we just check the click store write)
    mockCalibrateEngine.mockReturnValue(new Promise(() => {}));

    render(<CalibrateButton />);

    act(() => {
      clickCalibrateButton();
    });

    expect(useAppStore.getState().measurePhase).toBe('calibrating');
  });

  it('(b) sets measurePhase to "idle" after successful calibration + CONFIRMATION_DURATION_MS', async () => {
    mockCalibrateEngine.mockResolvedValue({ ambientDbFs: -50, stableBaseline: true });

    render(<CalibrateButton />);

    act(() => {
      clickCalibrateButton();
    });

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

    expect(useAppStore.getState().measurePhase).toBe('idle');
  });

  it('does not reset measurePhase if a measurement starts during the confirmation window', async () => {
    mockCalibrateEngine.mockResolvedValue({ ambientDbFs: -50, stableBaseline: true });

    render(<CalibrateButton />);

    act(() => {
      clickCalibrateButton();
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      useAppStore.getState().setMeasurePhase('countdown');
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(useAppStore.getState().measurePhase).toBe('countdown');
  });

  it('(c) sets measurePhase to "idle" immediately on calibration error', async () => {
    mockCalibrateEngine.mockRejectedValue(new Error('Mic lost'));

    render(<CalibrateButton />);

    act(() => {
      clickCalibrateButton();
    });

    // Advance through 3s countdown to start capture phase
    await act(async () => {
      vi.advanceTimersByTime(3000);
      // Flush microtasks so the rejected calibrate() promise is caught
      await Promise.resolve();
      await Promise.resolve();
    });

    // The idle store write should have been called immediately in the catch block
    // (before any 2500ms timer advance)
    expect(useAppStore.getState().measurePhase).toBe('idle');
  });
});
