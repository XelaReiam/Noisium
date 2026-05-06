import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { MeasurementOrchestrator } from './MeasurementOrchestrator';
import { useAppStore } from '../store/useAppStore';

// ---------------------------------------------------------------------------
// Mock useAudioEngine — provide a controllable engine ref
// ---------------------------------------------------------------------------
const mockStartMeasurement = vi.fn();
const mockCalibrateEngine = vi.fn();

vi.mock('../hooks/useAudioEngine', () => ({
  useAudioEngine: () => ({
    current: {
      startMeasurement: mockStartMeasurement,
      calibrate: mockCalibrateEngine,
    },
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setupStore() {
  useAppStore.getState().clearSession();
  useAppStore.getState().addDemo('TestDemo');
  return useAppStore.getState().demos[0].id;
}

describe('MeasurementOrchestrator — measurePhase transitions (Phase 4)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    // Reset store
    useAppStore.getState().clearSession();
  });

  it('(a) sets measurePhase to countdown immediately on startMeasure', () => {
    const demoId = setupStore();
    render(<MeasurementOrchestrator />);

    act(() => {
      useAppStore.getState().startMeasure(demoId);
    });

    expect(useAppStore.getState().measurePhase).toBe('countdown');
  });

  it('(b) sets measurePhase to measuring after 3000ms countdown', async () => {
    const demoId = setupStore();

    // Engine will return a promise that never resolves during this test
    // (we just check the transition, not the result)
    let resolveEngine: ((v: { aborted: false; avgDbFs: number }) => void) | null = null;
    mockStartMeasurement.mockReturnValue(
      new Promise<{ aborted: false; avgDbFs: number }>((resolve) => {
        resolveEngine = resolve;
      }),
    );

    render(<MeasurementOrchestrator />);

    act(() => {
      useAppStore.getState().startMeasure(demoId);
    });

    // Before 3000ms — still in countdown
    expect(useAppStore.getState().measurePhase).toBe('countdown');

    // Advance past the 3-second countdown
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(useAppStore.getState().measurePhase).toBe('measuring');
    expect(mockStartMeasurement).toHaveBeenCalledWith(
      useAppStore.getState().windowSeconds,
      expect.any(AbortSignal),
    );

    // Clean up: resolve the promise so no dangling async work
    resolveEngine?.({ aborted: false, avgDbFs: -38 });
  });

  it('(c) sets measurePhase to window-end after engine resolves, then idle after 1200ms', async () => {
    const demoId = setupStore();
    useAppStore.getState().setCalibrationAmbient(-50);

    let resolveEngine: ((v: { aborted: false; avgDbFs: number }) => void) | null = null;
    mockStartMeasurement.mockReturnValue(
      new Promise<{ aborted: false; avgDbFs: number }>((resolve) => {
        resolveEngine = resolve;
      }),
    );

    render(<MeasurementOrchestrator />);

    act(() => {
      useAppStore.getState().startMeasure(demoId);
    });

    // Advance through countdown (3s)
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(useAppStore.getState().measurePhase).toBe('measuring');

    // Engine resolves with a score
    await act(async () => {
      resolveEngine?.({ aborted: false, avgDbFs: -38 });
      // Flush microtasks
      await Promise.resolve();
    });

    // After engine resolves, measurePhase should be 'window-end' briefly
    expect(useAppStore.getState().measurePhase).toBe('window-end');

    // Advance 1200ms — completeMeasure fires, store resets measurePhase to 'idle'
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    expect(useAppStore.getState().measurePhase).toBe('idle');
    // completeMeasure should have stored the score
    expect(useAppStore.getState().scores[demoId]).toBeDefined();
  });
});
