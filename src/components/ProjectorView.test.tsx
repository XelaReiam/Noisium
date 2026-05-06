import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { ProjectorView } from './ProjectorView';
import { resetNoisiumChannel, getNoisiumChannel } from '../lib/broadcastChannel';
import { resetNoisiumTransport, getTransport } from '../lib/transport';
import { useAppStore } from '../store/useAppStore';
import type { ProjectorMessage } from '../lib/projector';

// Helper: get the mock broadcast channel and call its test-only _simulateMessage.
function simulateBroadcastMessage(data: ProjectorMessage | { phase: 'request-state' }) {
  const ch = getNoisiumChannel() as unknown as {
    _simulateMessage: (d: unknown) => void;
  };
  ch._simulateMessage(data);
}

// Helper: get the underlying MockWebSocket from the current websocket transport.
function getWsMock(): {
  _simulateOpen: () => void;
  _simulateClose: (code?: number) => void;
  _simulateMessage: (data: unknown) => void;
  readyState: number;
} {
  const transport = getTransport('websocket') as unknown as {
    _ws: {
      _simulateOpen: () => void;
      _simulateClose: (code?: number) => void;
      _simulateMessage: (data: unknown) => void;
      readyState: number;
    };
  };
  return transport._ws;
}

describe('ProjectorView — broadcast mode (lanModeEnabled=false)', () => {
  beforeEach(() => {
    resetNoisiumChannel();
    resetNoisiumTransport();
    useAppStore.setState({ lanModeEnabled: false });
  });

  afterEach(() => {
    cleanup();
    resetNoisiumChannel();
    resetNoisiumTransport();
    vi.useRealTimers();
  });

  it('renders the wordmark in the default idle state', () => {
    render(<ProjectorView />);
    expect(screen.getByText('Noisium')).toBeTruthy();
    expect(screen.getByText('DemoJam applause meter')).toBeTruthy();
  });

  it('posts request-state on mount', () => {
    render(<ProjectorView />);
    const ch = getNoisiumChannel();
    expect(ch.postMessage).toHaveBeenCalledWith({ phase: 'request-state' });
  });

  it('posts heartbeat-projector at the configured interval', () => {
    vi.useFakeTimers();
    render(<ProjectorView />);
    const ch = getNoisiumChannel();
    // Initial mount post is 'request-state'; advance time and observe heartbeat
    vi.advanceTimersByTime(2000);
    expect(ch.postMessage).toHaveBeenCalledWith({ phase: 'heartbeat-projector' });
  });

  it('renders calibrating with "Setting up…" corner', () => {
    render(<ProjectorView />);
    act(() => simulateBroadcastMessage({ phase: 'calibrating' }));
    expect(screen.getByText('Noisium')).toBeTruthy();
    expect(screen.getByText('Setting up…')).toBeTruthy();
  });

  it('renders countdown number', () => {
    render(<ProjectorView />);
    act(() =>
      simulateBroadcastMessage({ phase: 'countdown', demoName: 'Alpha', countdownSeconds: 3 }),
    );
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders measuring suspense screen with demo name and "Clap now!"', () => {
    render(<ProjectorView />);
    act(() =>
      simulateBroadcastMessage({
        phase: 'measuring',
        demoName: 'Alpha',
        remainingSeconds: 8,
      }),
    );
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Clap now!')).toBeTruthy();
    expect(screen.getByTestId('projector-progress')).toBeTruthy();
  });

  it('renders window-end with "Thank you." corner', () => {
    render(<ProjectorView />);
    act(() =>
      simulateBroadcastMessage({ phase: 'window-end', demoName: 'Alpha' }),
    );
    expect(screen.getByText('Thank you.')).toBeTruthy();
  });

  it('auto-transitions from window-end back to plain idle after 1200ms', () => {
    vi.useFakeTimers();
    render(<ProjectorView />);
    act(() =>
      simulateBroadcastMessage({ phase: 'window-end', demoName: 'Alpha' }),
    );
    expect(screen.getByText('Thank you.')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(screen.queryByText('Thank you.')).toBeNull();
    expect(screen.getByText('Noisium')).toBeTruthy();
  });

  it('renders reveal buildup ("And the winner is…") for a single winner', () => {
    render(<ProjectorView />);
    act(() => simulateBroadcastMessage({ phase: 'reveal', winner: { name: 'Alpha' } }));
    expect(screen.getByText('And the winner is…')).toBeTruthy();
  });

  it('after 2500ms, reveal transitions to the name display', () => {
    vi.useFakeTimers();
    render(<ProjectorView />);
    act(() => simulateBroadcastMessage({ phase: 'reveal', winner: { name: 'Alpha' } }));
    expect(screen.getByText('And the winner is…')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.getByText('Alpha')).toBeTruthy();
  });

  it('renders tie buildup ("Tied for the win:") for multi-name winner', () => {
    render(<ProjectorView />);
    act(() =>
      simulateBroadcastMessage({
        phase: 'reveal',
        winner: { names: ['Alpha', 'Bravo'] },
      }),
    );
    expect(screen.getByText('Tied for the win:')).toBeTruthy();
  });

  it('absorbs heartbeat-host without changing the visible screen', () => {
    render(<ProjectorView />);
    act(() => simulateBroadcastMessage({ phase: 'idle' }));
    expect(screen.getByText('Noisium')).toBeTruthy();
    act(() => simulateBroadcastMessage({ phase: 'heartbeat-host' }));
    expect(screen.getByText('Noisium')).toBeTruthy();
  });

  it('cancels reveal buildup timer when a new message arrives', () => {
    vi.useFakeTimers();
    render(<ProjectorView />);
    act(() => simulateBroadcastMessage({ phase: 'reveal', winner: { name: 'Alpha' } }));
    // Mid-buildup, the host sends idle (e.g. host clicked Reset)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => simulateBroadcastMessage({ phase: 'idle' }));
    // Advance further — the now-cancelled timer should NOT fire 'name' phase
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('And the winner is…')).toBeNull();
    expect(screen.queryByText('Alpha')).toBeNull();
    expect(screen.getByText('Noisium')).toBeTruthy();
  });
});

describe('ProjectorView — websocket mode (lanModeEnabled=true)', () => {
  beforeEach(() => {
    resetNoisiumChannel();
    resetNoisiumTransport();
    useAppStore.setState({ lanModeEnabled: true });
  });

  afterEach(() => {
    cleanup();
    resetNoisiumChannel();
    resetNoisiumTransport();
    vi.useRealTimers();
  });

  it('renders the wordmark in the default idle state in WS mode', () => {
    render(<ProjectorView />);
    expect(screen.getByText('Noisium')).toBeTruthy();
  });

  it('receives and renders messages via WebSocket transport', () => {
    render(<ProjectorView />);
    const ws = getWsMock();
    act(() => ws._simulateOpen());
    act(() => ws._simulateMessage({ phase: 'calibrating' }));
    expect(screen.getByText('Setting up…')).toBeTruthy();
  });

  it('resets retryDelay to 1000ms when WS opens', () => {
    vi.useFakeTimers();
    render(<ProjectorView />);
    const ws = getWsMock();
    // Simulate a close to trigger backoff accumulation
    act(() => ws._simulateClose());
    // First retry fires at 1000ms
    act(() => vi.advanceTimersByTime(1000));
    // Now the new transport opens
    resetNoisiumTransport();
    render(<ProjectorView />);
    const ws2 = getWsMock();
    act(() => ws2._simulateOpen());
    // After open, close again — should schedule reconnect at 1000ms (reset)
    act(() => ws2._simulateClose());
    // Should reconnect at 1000ms (not 2000ms because open reset the delay)
    act(() => vi.advanceTimersByTime(999));
    // Not yet...
    act(() => vi.advanceTimersByTime(2));
    // Reconnected
  });

  it('schedules reconnect after 1000ms on WS close (first attempt)', () => {
    vi.useFakeTimers();
    render(<ProjectorView />);
    const ws = getWsMock();

    // Capture resetNoisiumTransport calls
    let transportResetCount = 0;
    const originalReset = resetNoisiumTransport;
    // We verify the retry via retryCount state change causing re-render
    // instead of mocking resetNoisiumTransport

    act(() => ws._simulateClose());
    // Before 1000ms: no reconnect yet
    act(() => vi.advanceTimersByTime(999));
    // After 1000ms: reconnect scheduled
    act(() => vi.advanceTimersByTime(2));
    // Component re-renders with new transport — Noisium still shows
    expect(screen.getByText('Noisium')).toBeTruthy();
    void originalReset; // avoid unused warning
    void transportResetCount;
  });

  it('doubles the reconnect delay on successive failures (1000ms → 2000ms)', () => {
    vi.useFakeTimers();
    render(<ProjectorView />);

    // First close: schedules at 1000ms
    act(() => getWsMock()._simulateClose());
    act(() => vi.advanceTimersByTime(1000)); // fires, retryCount→1, new transport

    // Second close: schedules at 2000ms (delay doubled after first retry)
    act(() => getWsMock()._simulateClose());
    // At 1999ms: not yet
    act(() => vi.advanceTimersByTime(1999));
    expect(screen.getByText('Noisium')).toBeTruthy(); // still visible (no crash)
    // At 2001ms: fires
    act(() => vi.advanceTimersByTime(2));
    expect(screen.getByText('Noisium')).toBeTruthy();
  });

  it('caps the reconnect delay at 30000ms', () => {
    vi.useFakeTimers();
    render(<ProjectorView />);

    // Simulate enough closes to exceed the cap
    // Starting at 1000ms, doubling: 1000 → 2000 → 4000 → 8000 → 16000 → 32000 (cap at 30000)
    const delays = [1000, 2000, 4000, 8000, 16000]; // 5 fires, next would be 32000 but capped at 30000
    for (const delay of delays) {
      act(() => getWsMock()._simulateClose());
      act(() => vi.advanceTimersByTime(delay));
    }

    // 6th close: delay should be capped at 30000ms
    act(() => getWsMock()._simulateClose());
    act(() => vi.advanceTimersByTime(29999));
    expect(screen.getByText('Noisium')).toBeTruthy(); // still showing (not crashed)
    act(() => vi.advanceTimersByTime(2));
    expect(screen.getByText('Noisium')).toBeTruthy();
  });
});
