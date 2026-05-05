import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MicPermission } from '../lib/audioEngine';
import { computeDelta, type Score } from '../lib/measurement';

export type { MicPermission };
export type WindowSeconds = 5 | 8 | 10;

export interface Demo {
  id: string;
  name: string;
}

// Re-export so Plans 03-04 / 03-05 can `import { Score } from '../store/useAppStore'`
// (matches the existing MicPermission re-export pattern).
export type { Score };

export interface AppState {
  // -- Persisted data fields ----
  windowSeconds: WindowSeconds;
  sessionDate: string | null; // 'YYYY-MM-DD' or null on first ever load

  // Phase 3 persisted: event-day data (demos, scores, skips)
  demos: Demo[];
  scores: Record<string, Score>;
  skippedDemoIds: string[];

  // -- Transient fields (excluded from persistence) ----
  persistenceWorking: boolean;
  crossDayPromptShown: boolean;

  // Phase 2 transient mic state — NOT persisted (partialize unchanged)
  micPermission: MicPermission;
  micDeviceId: string | null;
  audioReady: boolean;

  // Phase 3 transient measurement state
  // calibrationAmbientDb is transient because calibration MUST run in the
  // actual event room — yesterday's living-room baseline corrupts today's
  // event. CONTEXT.md is explicit on this.
  calibrationAmbientDb: number | null;
  measuringDemoId: string | null;
  abortedDemoId: string | null;
  abortMessage: string | null;
  redoConfirmDemoId: string | null;

  // -- Actions ----
  setWindowSeconds: (s: WindowSeconds) => void;
  setSessionDate: (date: string) => void;
  setPersistenceWorking: (working: boolean) => void;
  setCrossDayPromptShown: (shown: boolean) => void;

  // Phase 2 mic-state setters
  setMicPermission: (p: MicPermission) => void;
  setMicDeviceId: (id: string | null) => void;
  setAudioReady: (ready: boolean) => void;

  // Phase 3 — demo CRUD
  addDemo: (name: string) => void;
  removeDemo: (id: string) => void;
  renameDemo: (id: string, name: string) => void;
  moveDemo: (id: string, direction: 'up' | 'down') => void;

  // Phase 3 — calibration
  setCalibrationAmbient: (db: number) => void;

  // Phase 3 — measurement lifecycle
  startMeasure: (demoId: string) => void;
  completeMeasure: (demoId: string, avgDbFs: number) => void;
  abortMeasure: (demoId: string, reason: 'state-change' | 'device-change' | 'manual') => void;
  clearAbort: () => void;

  // Phase 3 — skip / redo
  skipDemo: (id: string) => void;
  unskipDemo: (id: string) => void;
  requestRedo: (id: string) => void;
  cancelRedo: () => void;
  confirmRedo: (id: string) => void;

  clearSession: () => void;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
}

function abortReasonToMessage(reason: 'state-change' | 'device-change' | 'manual'): string {
  // Single source of truth for the abort warning copy. Plans 03-05's
  // AbortWarning component reads `state.abortMessage` directly — no per-component
  // string interpolation needed.
  switch (reason) {
    case 'state-change':
      return 'Measurement aborted — audio interrupted.';
    case 'device-change':
      return 'Measurement aborted — microphone changed.';
    case 'manual':
      return 'Measurement aborted.';
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // -- Persisted defaults ----
      windowSeconds: 8,
      sessionDate: todayISO(),

      // Phase 3 persisted defaults
      demos: [],
      scores: {},
      skippedDemoIds: [],

      // -- Transient defaults ----
      persistenceWorking: true, // overwritten in main.tsx by the probe
      crossDayPromptShown: false,

      // Phase 2 mic-state defaults — all transient
      micPermission: 'idle',
      micDeviceId: null,
      audioReady: false,

      // Phase 3 transient defaults
      calibrationAmbientDb: null,
      measuringDemoId: null,
      abortedDemoId: null,
      abortMessage: null,
      redoConfirmDemoId: null,

      // -- Phase 1 setters ----
      setWindowSeconds: (s) => set({ windowSeconds: s }),
      setSessionDate: (date) => set({ sessionDate: date }),
      setPersistenceWorking: (working) => set({ persistenceWorking: working }),
      setCrossDayPromptShown: (shown) => set({ crossDayPromptShown: shown }),

      // -- Phase 2 setters ----
      setMicPermission: (p) => set({ micPermission: p }),
      setMicDeviceId: (id) => set({ micDeviceId: id }),
      setAudioReady: (ready) => set({ audioReady: ready }),

      // -- Phase 3 demo CRUD ----
      addDemo: (name) =>
        set((state) => {
          const trimmed = name.trim();
          if (!trimmed) return state;
          return {
            demos: [...state.demos, { id: crypto.randomUUID(), name: trimmed }],
          };
        }),

      removeDemo: (id) =>
        set((state) => {
          const { [id]: _removed, ...remainingScores } = state.scores;
          return {
            demos: state.demos.filter((d) => d.id !== id),
            scores: remainingScores,
            skippedDemoIds: state.skippedDemoIds.filter((sid) => sid !== id),
          };
        }),

      renameDemo: (id, name) =>
        set((state) => {
          const trimmed = name.trim();
          if (!trimmed) return state;
          return {
            demos: state.demos.map((d) => (d.id === id ? { ...d, name: trimmed } : d)),
          };
        }),

      moveDemo: (id, direction) =>
        set((state) => {
          const idx = state.demos.findIndex((d) => d.id === id);
          if (idx === -1) return state;
          const newIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (newIdx < 0 || newIdx >= state.demos.length) return state;
          const next = state.demos.slice();
          const tmp = next[idx];
          next[idx] = next[newIdx];
          next[newIdx] = tmp;
          return { demos: next };
        }),

      // -- Phase 3 calibration ----
      setCalibrationAmbient: (db) => set({ calibrationAmbientDb: db }),

      // -- Phase 3 measurement lifecycle ----
      startMeasure: (demoId) =>
        // Defensively clear any stale abort/redo UI state — see RESEARCH Pitfall 3 + 4
        set({
          measuringDemoId: demoId,
          abortMessage: null,
          abortedDemoId: null,
          redoConfirmDemoId: null,
        }),

      completeMeasure: (demoId, avgDbFs) =>
        set((state) => {
          const score: Score = {
            avgDbFs,
            deltaDb: computeDelta(avgDbFs, state.calibrationAmbientDb ?? 0),
            capturedAt: new Date().toISOString(),
          };
          return {
            scores: { ...state.scores, [demoId]: score },
            // A measured demo is no longer skipped.
            skippedDemoIds: state.skippedDemoIds.filter((sid) => sid !== demoId),
            measuringDemoId: null,
          };
        }),

      abortMeasure: (demoId, reason) =>
        set({
          measuringDemoId: null,
          abortedDemoId: demoId,
          abortMessage: abortReasonToMessage(reason),
        }),

      clearAbort: () =>
        set({
          abortMessage: null,
          abortedDemoId: null,
        }),

      // -- Phase 3 skip / redo ----
      skipDemo: (id) =>
        set((state) =>
          state.skippedDemoIds.includes(id)
            ? state
            : { skippedDemoIds: [...state.skippedDemoIds, id] },
        ),

      unskipDemo: (id) =>
        set((state) => ({
          skippedDemoIds: state.skippedDemoIds.filter((sid) => sid !== id),
        })),

      requestRedo: (id) => set({ redoConfirmDemoId: id }),
      cancelRedo: () => set({ redoConfirmDemoId: null }),

      confirmRedo: (id) =>
        set((state) => {
          const { [id]: _removed, ...remainingScores } = state.scores;
          return {
            scores: remainingScores,
            skippedDemoIds: state.skippedDemoIds.filter((sid) => sid !== id),
            redoConfirmDemoId: null,
          };
        }),

      // -- clearSession (extends Phase 2's reset) ----
      clearSession: () =>
        set({
          // Phase 1
          windowSeconds: 8,
          sessionDate: todayISO(),
          // Phase 2
          micPermission: 'idle',
          micDeviceId: null,
          audioReady: false,
          // Phase 3 persisted
          demos: [],
          scores: {},
          skippedDemoIds: [],
          // Phase 3 transient
          calibrationAmbientDb: null,
          measuringDemoId: null,
          abortedDemoId: null,
          abortMessage: null,
          redoConfirmDemoId: null,
        }),
    }),
    {
      name: 'noisium:state',
      storage: createJSONStorage(() => localStorage),
      // Phase 3: partialize updated to include the three new persisted fields.
      // Transient fields (calibrationAmbientDb, measuringDemoId, abortedDemoId,
      // abortMessage, redoConfirmDemoId, and all Phase 1+2 transients) remain excluded.
      partialize: (state) => ({
        windowSeconds: state.windowSeconds,
        sessionDate: state.sessionDate,
        demos: state.demos,
        scores: state.scores,
        skippedDemoIds: state.skippedDemoIds,
      }),
    },
  ),
);
