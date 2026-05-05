import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MicPermission } from '../lib/audioEngine';

export type { MicPermission };
export type WindowSeconds = 5 | 8 | 10;

export interface AppState {
  // Persisted data fields
  windowSeconds: WindowSeconds;
  sessionDate: string | null; // 'YYYY-MM-DD' or null on first ever load

  // Transient fields — excluded from persistence; reset on every page load
  persistenceWorking: boolean;
  crossDayPromptShown: boolean;

  // Phase 2 transient mic state — NOT persisted (partialize unchanged)
  micPermission: MicPermission;
  micDeviceId: string | null;
  audioReady: boolean;

  // Actions
  setWindowSeconds: (s: WindowSeconds) => void;
  setSessionDate: (date: string) => void;
  setPersistenceWorking: (working: boolean) => void;
  setCrossDayPromptShown: (shown: boolean) => void;

  // Phase 2 mic-state setters
  setMicPermission: (p: MicPermission) => void;
  setMicDeviceId: (id: string | null) => void;
  setAudioReady: (ready: boolean) => void;

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

      // Phase 2 mic-state defaults — all transient
      micPermission: 'idle',
      micDeviceId: null,
      audioReady: false,

      // Actions
      setWindowSeconds: (s) => set({ windowSeconds: s }),
      setSessionDate: (date) => set({ sessionDate: date }),
      setPersistenceWorking: (working) => set({ persistenceWorking: working }),
      setCrossDayPromptShown: (shown) => set({ crossDayPromptShown: shown }),

      // Phase 2 setters
      setMicPermission: (p) => set({ micPermission: p }),
      setMicDeviceId: (id) => set({ micDeviceId: id }),
      setAudioReady: (ready) => set({ audioReady: ready }),

      clearSession: () =>
        set({
          windowSeconds: 8,
          sessionDate: todayISO(),
          // Phase 2: reset mic state too — Cross-day "Start fresh" should
          // fully reset the session, including any granted mic state.
          // The engine teardown (engineRef.dispose()) is wired separately
          // in MicPanel via a useEffect watching micPermission === 'idle'.
          micPermission: 'idle',
          micDeviceId: null,
          audioReady: false,
        }),
    }),
    {
      name: 'noisium:state',
      storage: createJSONStorage(() => localStorage),
      // CRITICAL: partialize remains UNCHANGED — micPermission, micDeviceId,
      // audioReady are transient and MUST NOT reach localStorage.
      partialize: (state) => ({
        windowSeconds: state.windowSeconds,
        sessionDate: state.sessionDate,
      }),
    },
  ),
);
