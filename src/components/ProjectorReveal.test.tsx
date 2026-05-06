import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ProjectorReveal } from './ProjectorReveal';

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ProjectorReveal', () => {
  describe('displayPhase=buildup', () => {
    it('renders buildup text for single winner', () => {
      render(<ProjectorReveal winner={{ name: 'Alice' }} displayPhase="buildup" />);
      expect(screen.getByText('And the winner is…')).toBeTruthy();
    });

    it('renders buildup text for tied winners', () => {
      render(<ProjectorReveal winner={{ names: ['Alice', 'Bob'] }} displayPhase="buildup" />);
      expect(screen.getByText('Tied for the win:')).toBeTruthy();
    });

    it('does not render a canvas when displayPhase=buildup', () => {
      const { container } = render(
        <ProjectorReveal winner={{ name: 'Alice' }} displayPhase="buildup" />,
      );
      const canvas = container.querySelector('canvas');
      expect(canvas).toBeNull();
    });
  });

  describe('displayPhase=name', () => {
    it('renders winner name for single winner', () => {
      render(<ProjectorReveal winner={{ name: 'Alice' }} displayPhase="name" />);
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    it('renders all winner names for tied winners', () => {
      render(<ProjectorReveal winner={{ names: ['Alice', 'Bob'] }} displayPhase="name" />);
      expect(screen.getByText('Alice')).toBeTruthy();
      expect(screen.getByText('Bob')).toBeTruthy();
    });

    it('renders a canvas when displayPhase=name (ConfettiCanvas active)', () => {
      const { container } = render(
        <ProjectorReveal winner={{ name: 'Alice' }} displayPhase="name" />,
      );
      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
    });

    it('renders a canvas for tied winners when displayPhase=name', () => {
      const { container } = render(
        <ProjectorReveal winner={{ names: ['Alice', 'Bob'] }} displayPhase="name" />,
      );
      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
    });
  });

  it('works without a store provider (no useAppStore import)', () => {
    // Props-only component: rendering without any context should not throw.
    expect(() =>
      render(<ProjectorReveal winner={{ name: 'Alice' }} displayPhase="name" />),
    ).not.toThrow();
  });
});
