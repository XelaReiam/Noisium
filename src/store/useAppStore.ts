import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type WindowSeconds = 5 | 8 | 10;

export interface AppState {
  // Persisted data fields
  windowSeconds: WindowSeconds;
  sessionDate: string | null; // 'YYYY-MM-DD' or null on first ever load

  // Transient fields — excluded from persistence; reset on every page load
  persistenceWorking: boolean;
  crossDayPromptShown: boolean;

  // Actions
  setWindowSeconds: (s: WindowSeconds) => void;
  setSessionDate: (date: string) => void;
  setPersistenceWorking: (working: boolean) => void;
  setCrossDayPromptShown: (shown: boolean) => void;
  clearSession: () => void;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Persisted defaults
      windowSeconds: 8,
      sessionDate: todayISO(),

      // Transient defaults
      persistenceWorking: true, // overwritten in main.tsx by the probe
      crossDayPromptShown: false,

      // Actions
      setWindowSeconds: (s) => set({ windowSeconds: s }),
      setSessionDate: (date) => set({ sessionDate: date }),
      setPersistenceWorking: (working) => set({ persistenceWorking: working }),
      setCrossDayPromptShown: (shown) => set({ crossDayPromptShown: shown }),
      clearSession: () =>
        set({
          windowSeconds: 8,
          sessionDate: todayISO(),
          // Note: crossDayPromptShown is transient — leaving it at its current
          // value is fine; CrossDayModal in plan 03 handles dismissal.
        }),
    }),
    {
      name: 'noisium:state',
      storage: createJSONStorage(() => localStorage),
      // CRITICAL: only persist the data fields. Functions and transients
      // are explicitly excluded. Adding a new persisted field in Phase 2-4
      // means adding it both to AppState and here.
      partialize: (state) => ({
        windowSeconds: state.windowSeconds,
        sessionDate: state.sessionDate,
      }),
    },
  ),
);
