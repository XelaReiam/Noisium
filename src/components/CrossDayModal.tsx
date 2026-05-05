import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function CrossDayModal() {
  const crossDayPromptShown = useAppStore((s) => s.crossDayPromptShown);
  const sessionDate = useAppStore((s) => s.sessionDate);
  const setCrossDayPromptShown = useAppStore((s) => s.setCrossDayPromptShown);
  const setSessionDate = useAppStore((s) => s.setSessionDate);
  const clearSession = useAppStore((s) => s.clearSession);

  const startFreshRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (crossDayPromptShown) {
      // Default focus on Start fresh — Enter key triggers the safe action.
      startFreshRef.current?.focus();
    }
  }, [crossDayPromptShown]);

  if (!crossDayPromptShown) return null;

  function handleStartFresh() {
    // Phase 2: dispose the audio engine BEFORE clearSession so the OS mic
    // indicator releases. The bridge is registered by MicPanel on mount.
    // @ts-expect-error — runtime bridge
    const dispose = window.__noisiumDisposeEngine as (() => void) | undefined;
    dispose?.();
    clearSession();
    setCrossDayPromptShown(false);
  }

  function handleRestore() {
    setSessionDate(todayISO());
    setCrossDayPromptShown(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cross-day-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 id="cross-day-heading" className="text-xl font-semibold text-gray-900 mb-2">
          Found a session from {sessionDate ?? 'a previous day'}.
        </h2>
        <p className="text-gray-700 mb-6">Start fresh, or restore it?</p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleRestore}
            className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Restore
          </button>
          <button
            ref={startFreshRef}
            type="button"
            onClick={handleStartFresh}
            className="px-4 py-2 rounded bg-gray-900 text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
          >
            Start fresh
          </button>
        </div>
      </div>
    </div>
  );
}
