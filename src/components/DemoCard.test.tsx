import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { DemoCard } from './DemoCard';
import { useAppStore } from '../store/useAppStore';
import type { Demo } from '../store/useAppStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDemoBase(overrides: Partial<Demo> = {}): Demo {
  return { id: 'demo-1', name: 'Alpha', ...overrides };
}

const defaultProps = {
  disabledMeasure: false,
  disabledMeasureHelper: '',
  globallyDisabled: false,
};

function renderCard(demo: Demo, overrides: Partial<typeof defaultProps> = {}) {
  return render(<DemoCard demo={demo} {...defaultProps} {...overrides} />);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  useAppStore.getState().clearSession();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useAppStore.getState().clearSession();
});

// ---------------------------------------------------------------------------
// Subject input tests
// ---------------------------------------------------------------------------

describe('DemoCard — subject input', () => {
  it('renders a text input with label containing "Subject"', () => {
    const demo = makeDemoBase();
    renderCard(demo);
    // Should find the aria-label containing "Subject"
    const input = screen.getByRole('textbox', { name: /subject for alpha/i });
    expect(input).toBeTruthy();
  });

  it('subject input shows demo.subject as defaultValue when set', () => {
    const demo = makeDemoBase({ subject: 'My App' });
    renderCard(demo);
    const input = screen.getByRole('textbox', { name: /subject for alpha/i }) as HTMLInputElement;
    expect(input.defaultValue).toBe('My App');
  });

  it('on subject blur with changed value calls updateDemoMeta with trimmed subject', () => {
    const demo = makeDemoBase();
    // Add demo to store so updateDemoMeta has something to update
    act(() => {
      useAppStore.setState((s) => ({
        demos: [...s.demos, demo],
      }));
    });
    const updateDemoMeta = vi.spyOn(useAppStore.getState(), 'updateDemoMeta');
    renderCard(demo);
    const input = screen.getByRole('textbox', { name: /subject for alpha/i }) as HTMLInputElement;
    fireEvent.blur(input, { target: { value: '  My App  ' } });
    expect(updateDemoMeta).toHaveBeenCalledWith('demo-1', { subject: 'My App' });
  });

  it('on subject blur with empty string calls updateDemoMeta with subject: undefined', () => {
    const demo = makeDemoBase({ subject: 'Old Subject' });
    const updateDemoMeta = vi.spyOn(useAppStore.getState(), 'updateDemoMeta');
    renderCard(demo);
    const input = screen.getByRole('textbox', { name: /subject for alpha/i }) as HTMLInputElement;
    fireEvent.blur(input, { target: { value: '' } });
    expect(updateDemoMeta).toHaveBeenCalledWith('demo-1', { subject: undefined });
  });
});

// ---------------------------------------------------------------------------
// Logo upload tests
// ---------------------------------------------------------------------------

describe('DemoCard — logo upload', () => {
  it('renders a file input with accept="image/*"', () => {
    const demo = makeDemoBase();
    renderCard(demo);
    const fileInput = screen.getByLabelText(/upload logo for alpha/i) as HTMLInputElement;
    expect(fileInput.type).toBe('file');
    expect(fileInput.accept).toBe('image/*');
  });

  it('renders an img preview with src=demo.logoUrl when set', () => {
    const demo = makeDemoBase({ logoUrl: 'data:image/png;base64,abc' });
    renderCard(demo);
    const img = screen.getByRole('img', { name: /alpha logo preview/i }) as HTMLImageElement;
    expect(img.src).toBe('data:image/png;base64,abc');
  });

  it('does NOT render img when demo.logoUrl is undefined', () => {
    const demo = makeDemoBase();
    renderCard(demo);
    const img = screen.queryByRole('img', { name: /alpha logo preview/i });
    expect(img).toBeNull();
  });

  it('file input change with file.size > 200KB shows error and does NOT call updateDemoMeta', () => {
    const demo = makeDemoBase();
    const updateDemoMeta = vi.spyOn(useAppStore.getState(), 'updateDemoMeta');
    renderCard(demo);
    const fileInput = screen.getByLabelText(/upload logo for alpha/i);
    // Create a large file (> 200KB)
    const largeFile = new File(['x'.repeat(201 * 1024)], 'big.png', { type: 'image/png' });
    Object.defineProperty(largeFile, 'size', { value: 201 * 1024 });
    fireEvent.change(fileInput, { target: { files: [largeFile] } });
    expect(screen.getByText(/under 200 kb/i)).toBeTruthy();
    expect(updateDemoMeta).not.toHaveBeenCalled();
  });

  it('file input change with valid file size triggers FileReader and calls updateDemoMeta', () => {
    const demo = makeDemoBase();
    const updateDemoMeta = vi.spyOn(useAppStore.getState(), 'updateDemoMeta');

    // Mock FileReader as a proper constructor that calls onload synchronously
    let capturedReader: { onload: (() => void) | null; result: string; readAsDataURL: (f: File) => void } | null = null;
    const readAsDataURLMock = vi.fn(function (this: typeof capturedReader) {
      // Synchronously call the onload that the component sets
      if (capturedReader && capturedReader.onload) {
        capturedReader.onload();
      }
    });

    class MockFileReader {
      onload: (() => void) | null = null;
      result: string = 'data:image/png;base64,mockdata';
      readAsDataURL(file: File): void {
        capturedReader = this;
        readAsDataURLMock(file);
        // Call onload synchronously after readAsDataURL is called
        if (this.onload) this.onload();
      }
    }

    vi.stubGlobal('FileReader', MockFileReader);

    renderCard(demo);
    const fileInput = screen.getByLabelText(/upload logo for alpha/i);
    const smallFile = new File(['small'], 'logo.png', { type: 'image/png' });
    Object.defineProperty(smallFile, 'size', { value: 100 });
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    expect(readAsDataURLMock).toHaveBeenCalledWith(smallFile);
    expect(updateDemoMeta).toHaveBeenCalledWith('demo-1', { logoUrl: 'data:image/png;base64,mockdata' });

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// Disabled state
// ---------------------------------------------------------------------------

describe('DemoCard — globally disabled', () => {
  it('inputs are not interactive when globallyDisabled is true (opacity/pointer-events class applied)', () => {
    const demo = makeDemoBase();
    const { container } = renderCard(demo, { globallyDisabled: true });
    // The outer wrapper should have opacity-50 pointer-events-none class
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toMatch(/opacity-50/);
    expect(wrapper.className).toMatch(/pointer-events-none/);
  });
});
