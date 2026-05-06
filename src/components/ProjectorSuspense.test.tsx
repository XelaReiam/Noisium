import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ProjectorSuspense } from './ProjectorSuspense';

// ---------------------------------------------------------------------------
// Mock rAF / cAF — jsdom does not provide real implementations.
// We return a fake id without calling the callback — ProjectorSuspense's
// rAF loop runs indefinitely (p < 1 re-queues), so calling back synchronously
// would cause infinite recursion. Tests only need the progress bar to render.
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectorSuspense', () => {
  it('renders demoSubject text below demoName when demoSubject prop supplied', () => {
    render(
      <ProjectorSuspense
        demoName="Alpha"
        remainingSeconds={8}
        demoSubject="My Cool App"
      />,
    );
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('My Cool App')).toBeTruthy();
  });

  it('renders img with src=demoLogoUrl when demoLogoUrl prop supplied', () => {
    render(
      <ProjectorSuspense
        demoName="Alpha"
        remainingSeconds={8}
        demoLogoUrl="data:image/png;base64,abc"
      />,
    );
    const img = screen.getByRole('img', { name: /alpha logo/i }) as HTMLImageElement;
    expect(img.src).toBe('data:image/png;base64,abc');
  });

  it('renders only demoName + "Clap now!" + progress bar when neither demoSubject nor demoLogoUrl supplied', () => {
    render(<ProjectorSuspense demoName="Beta" remainingSeconds={5} />);
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.getByText('Clap now!')).toBeTruthy();
    // No img should be present
    expect(screen.queryByRole('img')).toBeNull();
    // No subject paragraph — only the two expected paragraphs
    // (demoName + "Clap now!")
    const paragraphs = screen.getAllByRole('paragraph').filter(
      (p) => p.textContent !== 'Beta' && p.textContent !== 'Clap now!',
    );
    expect(paragraphs).toHaveLength(0);
  });

  it('does not render an img element when demoLogoUrl is absent', () => {
    render(
      <ProjectorSuspense
        demoName="Gamma"
        remainingSeconds={10}
        demoSubject="Some subject"
      />,
    );
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('progress bar is present in all cases', () => {
    render(
      <ProjectorSuspense
        demoName="Delta"
        remainingSeconds={8}
        demoSubject="Subject"
        demoLogoUrl="data:image/png;base64,xyz"
      />,
    );
    expect(screen.getByTestId('projector-progress')).toBeTruthy();
  });
});
