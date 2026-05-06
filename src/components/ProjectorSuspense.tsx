import { useEffect, useRef, useState } from 'react';

interface Props {
  demoName: string;
  /** Window length in seconds — typically 5/8/10. Drives the progress bar duration. */
  remainingSeconds: number;
  demoSubject?: string;   // META-03
  demoLogoUrl?: string;   // META-03
}

/**
 * The audience-facing suspense screen. Big demo name + "Clap now!" + a thin
 * bottom progress bar that fills smoothly over the configured window.
 *
 * Progress bar: rAF-driven from performance.now() per 04-RESEARCH Pattern 7.
 * Why not setInterval: rAF is smooth at 60fps; setInterval at 33ms has visible
 * jitter and frame-contention with the audio rendering (already running at
 * 30 Hz on the host). Per CONTEXT.md, fills left-to-right.
 */
export function ProjectorSuspense({ demoName, remainingSeconds, demoSubject, demoLogoUrl }: Props) {
  const startTimeRef = useRef<number>(performance.now());
  const [progress, setProgress] = useState<number>(0);
  const totalMs = Math.max(1, remainingSeconds * 1000);

  useEffect(() => {
    // Reset on prop change (a new demo started).
    startTimeRef.current = performance.now();
    setProgress(0);

    let rafId = 0;
    const tick = (): void => {
      const elapsed = performance.now() - startTimeRef.current;
      const p = Math.min(elapsed / totalMs, 1);
      setProgress(p);
      if (p < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [demoName, totalMs]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-16 text-center relative">
      {demoLogoUrl && (
        <img
          src={demoLogoUrl}
          alt={`${demoName} logo`}
          className="h-24 object-contain mb-6"
        />
      )}
      <p className="text-7xl font-bold text-gray-900">{demoName}</p>
      {demoSubject && (
        <p className="text-3xl font-medium text-gray-600 mt-4">{demoSubject}</p>
      )}
      <p className="text-4xl font-medium text-gray-700 mt-8">Clap now!</p>
      {/* Progress bar — fills left-to-right (CONTEXT.md / RESEARCH Pattern 7) */}
      <div
        className="fixed bottom-0 left-0 right-0 h-1.5 bg-gray-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        data-testid="projector-progress"
      >
        <div
          className="h-full bg-gray-900"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
