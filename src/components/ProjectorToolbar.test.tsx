import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ProjectorToolbar } from './ProjectorToolbar';
import { useAppStore } from '../store/useAppStore';

describe('ProjectorToolbar', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().clearSession();
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

  it('shows "Projector disconnected" by default', () => {
    render(<ProjectorToolbar />);
    expect(screen.getByText('Projector disconnected')).toBeTruthy();
    const dot = screen.getByTestId('projector-status-dot');
    expect(dot.className).toMatch(/bg-red-400/);
  });

  it('shows "Projector connected" when store is connected', () => {
    useAppStore.getState().setProjectorConnected(true);
    render(<ProjectorToolbar />);
    expect(screen.getByText('Projector connected')).toBeTruthy();
    const dot = screen.getByTestId('projector-status-dot');
    expect(dot.className).toMatch(/bg-green-500/);
  });

  it('updates reactively when projectorConnected changes', () => {
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
});
