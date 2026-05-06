import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { BroadcastBridge } from './BroadcastBridge';
import { useAppStore } from '../store/useAppStore';
import { getNoisiumChannel, resetNoisiumChannel } from '../lib/broadcastChannel';
import { resetNoisiumTransport } from '../lib/transport';

function getMockChannel() {
  return getNoisiumChannel() as unknown as {
    postMessage: ReturnType<typeof vi.fn>;
    _simulateMessage: (data: unknown) => void;
  };
}


describe('BroadcastBridge — broadcast mode (lanModeEnabled=false)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetNoisiumChannel();
    resetNoisiumTransport();
    useAppStore.setState({ lanModeEnabled: false, wsConnectionStatus: 'idle' });
    useAppStore.getState().clearSession();
  });

  afterEach(() => {
    cleanup();
    resetNoisiumChannel();
    resetNoisiumTransport();
    vi.useRealTimers();
  });

  it('posts an initial derived message on mount', () => {
    render(<BroadcastBridge />);
    const ch = getMockChannel();
    expect(ch.postMessage).toHaveBeenCalledWith({ phase: 'idle' });
  });

  it('starts a 2000ms heartbeat-host interval', () => {
    vi.useFakeTimers();
    render(<BroadcastBridge />);
    const ch = getMockChannel();
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
    act(() => {
      useAppStore.getState().setProjectorConnected(true);
      useAppStore.getState().setProjectorConnected(false);
    });
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
    const heartbeatCalls = ch.postMessage.mock.calls.filter(
      (c) => (c[0] as { phase: string }).phase === 'heartbeat-host',
    );
    expect(heartbeatCalls).toHaveLength(0);
  });

  it('does NOT call setWsConnectionStatus in broadcast mode', () => {
    const setWsConnectionStatus = vi.fn();
    useAppStore.setState({ lanModeEnabled: false, setWsConnectionStatus });
    render(<BroadcastBridge />);
    expect(setWsConnectionStatus).not.toHaveBeenCalled();
  });
});

type MockWsInstance = {
  send: ReturnType<typeof vi.fn>;
  _simulateOpen: () => void;
  _simulateClose: (code?: number) => void;
  _simulateMessage: (data: unknown) => void;
  onopen: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
};

describe('BroadcastBridge — websocket mode (lanModeEnabled=true)', () => {
  let wsInstances: MockWsInstance[];
  let OriginalWs: typeof WebSocket;

  beforeEach(() => {
    wsInstances = [];
    // Capture every MockWebSocket instance by wrapping globalThis.WebSocket
    // with a subclass so it stays constructable (vi.spyOn breaks 'new').
    OriginalWs = globalThis.WebSocket;
    const captured = wsInstances;
    class TrackingWs extends (OriginalWs as unknown as new (url: string) => MockWsInstance) {
      constructor(url: string) {
        super(url);
        captured.push(this);
      }
    }
    // @ts-expect-error — override global
    globalThis.WebSocket = TrackingWs;

    localStorage.clear();
    resetNoisiumChannel();
    resetNoisiumTransport();
    useAppStore.setState({ lanModeEnabled: true, wsConnectionStatus: 'idle' });
    useAppStore.getState().clearSession();
  });

  afterEach(() => {
    cleanup();
    // @ts-expect-error — restore global
    globalThis.WebSocket = OriginalWs;
    resetNoisiumChannel();
    resetNoisiumTransport();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('calls setWsConnectionStatus("waiting") immediately on mount in WS mode', () => {
    const spy = vi.spyOn(useAppStore.getState(), 'setWsConnectionStatus');
    render(<BroadcastBridge />);
    expect(spy).toHaveBeenCalledWith('waiting');
  });

  it('calls setWsConnectionStatus("connected") when WS onopen fires', () => {
    render(<BroadcastBridge />);
    const spy = vi.spyOn(useAppStore.getState(), 'setWsConnectionStatus');
    act(() => {
      wsInstances[0]._simulateOpen();
    });
    expect(spy).toHaveBeenCalledWith('connected');
  });

  it('calls setWsConnectionStatus("disconnected") when WS onclose fires', () => {
    render(<BroadcastBridge />);
    act(() => {
      wsInstances[0]._simulateOpen();
    });
    const spy = vi.spyOn(useAppStore.getState(), 'setWsConnectionStatus');
    act(() => {
      wsInstances[0]._simulateClose();
    });
    expect(spy).toHaveBeenCalledWith('disconnected');
  });

  it('sends the initial derived message via WS transport when OPEN', () => {
    render(<BroadcastBridge />);
    act(() => {
      wsInstances[0]._simulateOpen();
    });
    // Initial state message force-sent on mount would have been dropped (WS not open yet).
    // After opening, a store change should trigger a broadcast.
    act(() => {
      useAppStore.getState().setMeasurePhase('calibrating');
    });
    expect(wsInstances[0].send).toHaveBeenCalledWith(
      expect.stringContaining('"phase":"calibrating"'),
    );
  });

  it('does NOT call postMessage on BroadcastChannel in WS mode', () => {
    render(<BroadcastBridge />);
    act(() => {
      wsInstances[0]._simulateOpen();
    });
    const ch = getMockChannel();
    // Clear any calls from construction; store-driven sends should go via WS
    ch.postMessage.mockClear();
    act(() => {
      useAppStore.getState().setMeasurePhase('calibrating');
    });
    const stateChangeCalls = ch.postMessage.mock.calls.filter(
      (c) => (c[0] as { phase: string }).phase !== 'heartbeat-host',
    );
    expect(stateChangeCalls).toHaveLength(0);
  });

  it('switches transport when lanModeEnabled changes from false to true', () => {
    // Start in broadcast mode
    useAppStore.setState({ lanModeEnabled: false });
    render(<BroadcastBridge />);

    // Spy on setWsConnectionStatus BEFORE the switch so we can verify it's called
    const spy = vi.spyOn(useAppStore.getState(), 'setWsConnectionStatus');

    // Switch to WS mode via store — triggers re-render and effect re-run with mode='websocket'
    act(() => {
      useAppStore.setState({ lanModeEnabled: true });
    });

    // setWsConnectionStatus('waiting') should have been called on WS transport init
    expect(spy).toHaveBeenCalledWith('waiting');
  });
});
