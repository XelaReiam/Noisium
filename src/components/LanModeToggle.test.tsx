import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LanModeToggle } from './LanModeToggle';
import { useAppStore } from '../store/useAppStore';

describe('LanModeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().clearSession();
    // Ensure lanModeEnabled starts false
    useAppStore.setState({ lanModeEnabled: false });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders a labeled checkbox with "Local Network Mode" text', () => {
    render(<LanModeToggle />);
    expect(screen.getByLabelText('Local Network Mode')).toBeTruthy();
  });

  it('checkbox reflects lanModeEnabled=false from store', () => {
    useAppStore.setState({ lanModeEnabled: false });
    render(<LanModeToggle />);
    const checkbox = screen.getByLabelText('Local Network Mode') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('checkbox reflects lanModeEnabled=true from store', () => {
    useAppStore.setState({ lanModeEnabled: true });
    render(<LanModeToggle />);
    const checkbox = screen.getByLabelText('Local Network Mode') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('calls setLanModeEnabled(true) when checked', () => {
    const setLanModeEnabled = vi.fn();
    useAppStore.setState({ lanModeEnabled: false, setLanModeEnabled });
    render(<LanModeToggle />);
    const checkbox = screen.getByLabelText('Local Network Mode');
    fireEvent.click(checkbox);
    expect(setLanModeEnabled).toHaveBeenCalledWith(true);
  });

  it('calls setLanModeEnabled(false) when unchecked', () => {
    const setLanModeEnabled = vi.fn();
    useAppStore.setState({ lanModeEnabled: true, setLanModeEnabled });
    render(<LanModeToggle />);
    const checkbox = screen.getByLabelText('Local Network Mode');
    fireEvent.click(checkbox);
    expect(setLanModeEnabled).toHaveBeenCalledWith(false);
  });

  it('hides projector URL element when lanModeEnabled=false', () => {
    useAppStore.setState({ lanModeEnabled: false });
    render(<LanModeToggle />);
    expect(screen.queryByTestId('projector-url')).toBeNull();
  });

  it('shows projector URL element when lanModeEnabled=true', () => {
    useAppStore.setState({ lanModeEnabled: true });
    render(<LanModeToggle />);
    expect(screen.getByTestId('projector-url')).toBeTruthy();
  });

  it('projector URL contains the correct derived URL from window.location', () => {
    useAppStore.setState({ lanModeEnabled: true });
    render(<LanModeToggle />);
    const urlEl = screen.getByTestId('projector-url');
    // jsdom sets window.location.host (may include port e.g. localhost:3000),
    // so match the actual runtime value rather than a hardcoded hostname.
    const expectedUrl = `${window.location.protocol}//${window.location.host}/#/projector`;
    expect(urlEl.textContent).toBe(expectedUrl);
  });

  it('does not crash when lanModeEnabled=false (render-null-capable)', () => {
    useAppStore.setState({ lanModeEnabled: false });
    // Should not throw
    expect(() => render(<LanModeToggle />)).not.toThrow();
  });
});
