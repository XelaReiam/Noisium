import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ProjectorToolbar } from './ProjectorToolbar';
import { useAppStore } from '../store/useAppStore';

describe('ProjectorToolbar — broadcast mode (lanModeEnabled=false)', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().clearSession();
    useAppStore.setState({ lanModeEnabled: false });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders an "Open projector" button', () => {
    render(<ProjectorToolbar />);
    expect(screen.getByRole('button', { name: /open projector/i })).toBeTruthy();
  });

  it('calls window.open with the correct args on click', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<ProjectorToolbar />);
    fireEvent.click(screen.getByRole('button', { name: /open projector/i }));
    expect(openSpy).toHaveBeenCalledWith('#/projector', '_blank');
    openSpy.mockRestore();
  });

  it('shows "Projector disconnected" by default (broadcast mode)', () => {
    render(<ProjectorToolbar />);
    expect(screen.getByText('Projector disconnected')).toBeTruthy();
    const dot = screen.getByTestId('projector-status-dot');
    expect(dot.className).toMatch(/bg-red-400/);
  });

  it('shows "Projector connected" when projectorConnected=true (broadcast mode)', () => {
    useAppStore.getState().setProjectorConnected(true);
    render(<ProjectorToolbar />);
    expect(screen.getByText('Projector connected')).toBeTruthy();
    const dot = screen.getByTestId('projector-status-dot');
    expect(dot.className).toMatch(/bg-green-500/);
  });

  it('updates reactively when projectorConnected changes (broadcast mode)', () => {
    render(<ProjectorToolbar />);
    expect(screen.getByText('Projector disconnected')).toBeTruthy();
    act(() => {
      useAppStore.getState().setProjectorConnected(true);
    });
    expect(screen.getByText('Projector connected')).toBeTruthy();
    act(() => {
      useAppStore.getState().setProjectorConnected(false);
    });
    expect(screen.getByText('Projector disconnected')).toBeTruthy();
  });

  it('preserves role="status" and aria-live="polite" accessibility attributes', () => {
    render(<ProjectorToolbar />);
    const statusEl = screen.getByRole('status');
    expect(statusEl.getAttribute('aria-live')).toBe('polite');
  });
});

describe('ProjectorToolbar — LAN mode (lanModeEnabled=true) wsConnectionStatus labels', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().clearSession();
    useAppStore.setState({ lanModeEnabled: true });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows "Waiting for projector" when wsConnectionStatus="waiting"', () => {
    useAppStore.setState({ wsConnectionStatus: 'waiting' });
    render(<ProjectorToolbar />);
    expect(screen.getByText('Waiting for projector')).toBeTruthy();
    const dot = screen.getByTestId('projector-status-dot');
    expect(dot.className).toMatch(/bg-amber-400/);
  });

  it('shows "Projector connected" when wsConnectionStatus="connected"', () => {
    useAppStore.setState({ wsConnectionStatus: 'connected' });
    render(<ProjectorToolbar />);
    expect(screen.getByText('Projector connected')).toBeTruthy();
    const dot = screen.getByTestId('projector-status-dot');
    expect(dot.className).toMatch(/bg-green-500/);
  });

  it('shows "Projector disconnected" when wsConnectionStatus="disconnected"', () => {
    useAppStore.setState({ wsConnectionStatus: 'disconnected' });
    render(<ProjectorToolbar />);
    expect(screen.getByText('Projector disconnected')).toBeTruthy();
    const dot = screen.getByTestId('projector-status-dot');
    expect(dot.className).toMatch(/bg-red-400/);
  });

  it('shows "Projector disconnected" when wsConnectionStatus="idle"', () => {
    useAppStore.setState({ wsConnectionStatus: 'idle' });
    render(<ProjectorToolbar />);
    expect(screen.getByText('Projector disconnected')).toBeTruthy();
    const dot = screen.getByTestId('projector-status-dot');
    expect(dot.className).toMatch(/bg-red-400/);
  });

  it('shows "Reconnecting…" when wsConnectionStatus="reconnecting"', () => {
    useAppStore.setState({ wsConnectionStatus: 'reconnecting' });
    render(<ProjectorToolbar />);
    expect(screen.getByText('Reconnecting…')).toBeTruthy();
    const dot = screen.getByTestId('projector-status-dot');
    expect(dot.className).toMatch(/bg-amber-400/);
  });

  it('"Open projector" button is still present in LAN mode', () => {
    render(<ProjectorToolbar />);
    expect(screen.getByRole('button', { name: /open projector/i })).toBeTruthy();
  });

  it('updates reactively when wsConnectionStatus changes', () => {
    useAppStore.setState({ wsConnectionStatus: 'waiting' });
    render(<ProjectorToolbar />);
    expect(screen.getByText('Waiting for projector')).toBeTruthy();
    act(() => {
      useAppStore.setState({ wsConnectionStatus: 'connected' });
    });
    expect(screen.getByText('Projector connected')).toBeTruthy();
    act(() => {
      useAppStore.setState({ wsConnectionStatus: 'reconnecting' });
    });
    expect(screen.getByText('Reconnecting…')).toBeTruthy();
  });

  it('preserves role="status" and aria-live="polite" in LAN mode', () => {
    render(<ProjectorToolbar />);
    const statusEl = screen.getByRole('status');
    expect(statusEl.getAttribute('aria-live')).toBe('polite');
  });
});
