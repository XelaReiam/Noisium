import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { ProjectorView } from './ProjectorView';
import { resetNoisiumChannel, getNoisiumChannel } from '../lib/broadcastChannel';
import type { ProjectorMessage } from '../lib/projector';

// Helper: get the mock channel and call its test-only _simulateMessage.
function simulateMessage(data: ProjectorMessage | { phase: 'request-state' }) {
  const ch = getNoisiumChannel() as unknown as {
    _simulateMessage: (d: unknown) => void;
  };
  ch._simulateMessage(data);
}

describe('ProjectorView', () => {
  beforeEach(() => {
    resetNoisiumChannel();
  });

  afterEach(() => {
    cleanup();
    resetNoisiumChannel();
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
    act(() => simulateMessage({ phase: 'calibrating' }));
    expect(screen.getByText('Noisium')).toBeTruthy();
    expect(screen.getByText('Setting up…')).toBeTruthy();
  });

  it('renders countdown number', () => {
    render(<ProjectorView />);
    act(() =>
      simulateMessage({ phase: 'countdown', demoName: 'Alpha', countdownSeconds: 3 }),
    );
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders measuring suspense screen with demo name and "Clap now!"', () => {
    render(<ProjectorView />);
    act(() =>
      simulateMessage({
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
      simulateMessage({ phase: 'window-end', demoName: 'Alpha' }),
    );
    expect(screen.getByText('Thank you.')).toBeTruthy();
  });

  it('auto-transitions from window-end back to plain idle after 1200ms', () => {
    vi.useFakeTimers();
    render(<ProjectorView />);
    act(() =>
      simulateMessage({ phase: 'window-end', demoName: 'Alpha' }),
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
    act(() => simulateMessage({ phase: 'reveal', winner: { name: 'Alpha' } }));
    expect(screen.getByText('And the winner is…')).toBeTruthy();
  });

  it('after 2500ms, reveal transitions to the name display', () => {
    vi.useFakeTimers();
    render(<ProjectorView />);
    act(() => simulateMessage({ phase: 'reveal', winner: { name: 'Alpha' } }));
    expect(screen.getByText('And the winner is…')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.getByText('Alpha')).toBeTruthy();
  });

  it('renders tie buildup ("Tied for the win:") for multi-name winner', () => {
    render(<ProjectorView />);
    act(() =>
      simulateMessage({
        phase: 'reveal',
        winner: { names: ['Alpha', 'Bravo'] },
      }),
    );
    expect(screen.getByText('Tied for the win:')).toBeTruthy();
  });

  it('absorbs heartbeat-host without changing the visible screen', () => {
    render(<ProjectorView />);
    act(() => simulateMessage({ phase: 'idle' }));
    expect(screen.getByText('Noisium')).toBeTruthy();
    act(() => simulateMessage({ phase: 'heartbeat-host' }));
    expect(screen.getByText('Noisium')).toBeTruthy();
  });

  it('cancels reveal buildup timer when a new message arrives', () => {
    vi.useFakeTimers();
    render(<ProjectorView />);
    act(() => simulateMessage({ phase: 'reveal', winner: { name: 'Alpha' } }));
    // Mid-buildup, the host sends idle (e.g. host clicked Reset)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => simulateMessage({ phase: 'idle' }));
    // Advance further — the now-cancelled timer should NOT fire 'name' phase
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('And the winner is…')).toBeNull();
    expect(screen.queryByText('Alpha')).toBeNull();
    expect(screen.getByText('Noisium')).toBeTruthy();
  });
});

describe('ProjectorView privacy: no useAppStore import', () => {
  it('source file does not import useAppStore', async () => {
    // Read the source file at test time and assert no import of the store.
    // This is a structural privacy guarantee: even if a future PR adds a
    // `score` field to ProjectorMessage, the projector tab CANNOT silently
    // start reading the host's store directly.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ProjectorView.tsx'),
      'utf8',
    );
    expect(src).not.toContain('useAppStore');
    expect(src).not.toMatch(/from\s+['"]\.\.\/store/);
  });
});
