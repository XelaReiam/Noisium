import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ConfettiCanvas } from './ConfettiCanvas';

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ConfettiCanvas', () => {
  it('renders a canvas element when active=true', () => {
    const { container } = render(<ConfettiCanvas active={true} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });

  it('renders nothing when active=false', () => {
    const { container } = render(<ConfettiCanvas active={false} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeNull();
  });

  it('canvas has correct inline styles when active=true', () => {
    const { container } = render(<ConfettiCanvas active={true} />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).not.toBeNull();
    expect(canvas.style.position).toBe('absolute');
    expect(canvas.style.width).toBe('100%');
    expect(canvas.style.height).toBe('100%');
    expect(canvas.style.pointerEvents).toBe('none');
    expect(canvas.style.zIndex).toBe('0');
  });

  it('works without a store provider (no useAppStore import)', () => {
    // If ConfettiCanvas imported useAppStore it would throw outside a provider.
    // Simply rendering without a provider passing successfully proves the invariant.
    expect(() => render(<ConfettiCanvas active={true} />)).not.toThrow();
  });
});
