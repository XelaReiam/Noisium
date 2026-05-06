import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { BroadcastBridge } from './BroadcastBridge';
import { useAppStore } from '../store/useAppStore';
import { getNoisiumChannel, resetNoisiumChannel } from '../lib/broadcastChannel';

function getMockChannel() {
  return getNoisiumChannel() as unknown as {
    postMessage: ReturnType<typeof vi.fn>;
    _simulateMessage: (data: unknown) => void;
  };
}

describe('BroadcastBridge', () => {
  beforeEach(() => {
    localStorage.clear();
    resetNoisiumChannel();
    useAppStore.getState().clearSession();
  });

  afterEach(() => {
    cleanup();
    resetNoisiumChannel();
    vi.useRealTimers();
  });

  it('posts an initial derived message on mount', () => {
    render(<BroadcastBridge />);
    const ch = getMockChannel();
    // The default state derives to { phase: 'idle' } per Plan 04-01 logic.
    expect(ch.postMessage).toHaveBeenCalledWith({ phase: 'idle' });
  });

  it('starts a 2000ms heartbeat-host interval', () => {
    vi.useFakeTimers();
    render(<BroadcastBridge />);
    const ch = getMockChannel();
    // Clear the initial idle send so we can isolate the heartbeat.
    ch.postMessage.mockClear();
    vi.advanceTimersByTime(2000);
    expect(ch.postMessage).toHaveBeenCalledWith({ phase: 'heartbeat-host' });
  });

  it('broadcasts on store transition to measuring', () => {
    render(<BroadcastBridge />);
    const ch = getMockChannel();
    ch.postMessage.mockClear();
    act(() => {
      useAppStore.getState().addDemo('Alpha');
      const id = useAppStore.getState().demos[0].id;
      useAppStore.getState().startMeasure(id);
      useAppStore.getState().setMeasurePhase('measuring');
    });
    // The dedup logic means we may have several sends (idle → idle is skipped,
    // but the measuring transition is unique). Find the measuring one.
    const calls = ch.postMessage.mock.calls.map((c) => c[0]);
    expect(calls).toContainEqual(
      expect.objectContaining({
        phase: 'measuring',
        demoName: 'Alpha',
      }),
    );
  });

  it('broadcasts { phase: "calibrating" } when store setMeasurePhase("calibrating") is called', () => {
    render(<BroadcastBridge />);
    const ch = getMockChannel();
    ch.postMessage.mockClear();
    act(() => {
      useAppStore.getState().setMeasurePhase('calibrating');
    });
    const calls = ch.postMessage.mock.calls.map((c) => c[0]);
    expect(calls).toContainEqual({ phase: 'calibrating' });
  });

  it('broadcasts on triggerReveal', () => {
    render(<BroadcastBridge />);
    const ch = getMockChannel();
    act(() => {
      useAppStore.getState().addDemo('Alpha');
      const id = useAppStore.getState().demos[0].id;
      useAppStore.getState().setCalibrationAmbient(-50);
      useAppStore.getState().completeMeasure(id, -38);
    });
    ch.postMessage.mockClear();
    act(() => {
      useAppStore.getState().triggerReveal();
    });
    const calls = ch.postMessage.mock.calls.map((c) => c[0]);
    expect(calls).toContainEqual({
      phase: 'reveal',
      winner: { name: 'Alpha' },
    });
  });

  it('dedupes identical consecutive derived messages', () => {
    render(<BroadcastBridge />);
    const ch = getMockChannel();
    ch.postMessage.mockClear();
    // Fire a store update that does NOT change the derived message.
    // setProjectorConnected is irrelevant to the derived message — it should
    // NOT trigger a broadcast.
    act(() => {
      useAppStore.getState().setProjectorConnected(true);
      useAppStore.getState().setProjectorConnected(false);
    });
    // The bridge should have de-duped these — only zero or very few non-
    // derive-changing posts (heartbeats are time-driven, not state-driven).
    const stateChangeCalls = ch.postMessage.mock.calls.filter(
      (c) => (c[0] as { phase: string }).phase !== 'heartbeat-host',
    );
    expect(stateChangeCalls).toHaveLength(0);
  });

  it('re-broadcasts the current state when receiving request-state', () => {
    render(<BroadcastBridge />);
    const ch = getMockChannel();
    ch.postMessage.mockClear();
    act(() => {
      ch._simulateMessage({ phase: 'request-state' });
    });
    expect(ch.postMessage).toHaveBeenCalledWith({ phase: 'idle' });
  });

  it('updates projectorConnected on heartbeat-projector', () => {
    vi.useFakeTimers();
    render(<BroadcastBridge />);
    const ch = getMockChannel();
    expect(useAppStore.getState().projectorConnected).toBe(false);
    act(() => {
      ch._simulateMessage({ phase: 'heartbeat-projector' });
    });
    expect(useAppStore.getState().projectorConnected).toBe(true);
  });

  it('removes the listener and clears the interval on unmount', () => {
    vi.useFakeTimers();
    const { unmount } = render(<BroadcastBridge />);
    const ch = getMockChannel();
    ch.postMessage.mockClear();
    unmount();
    vi.advanceTimersByTime(5000);
    // No heartbeats after unmount.
    const heartbeatCalls = ch.postMessage.mock.calls.filter(
      (c) => (c[0] as { phase: string }).phase === 'heartbeat-host',
    );
    expect(heartbeatCalls).toHaveLength(0);
  });
});
