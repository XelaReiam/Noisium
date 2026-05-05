import { useRef } from 'react';
import { AudioEngine } from '../lib/audioEngine';
import { useAppStore } from '../store/useAppStore';

/**
 * Module-level singleton: ONE AudioEngine per host tab, shared across all
 * components that call useAudioEngine().
 *
 * Why module-level (not per-hook useRef): multiple components consume the
 * engine (MicPanel, CalibrateButton, MeasurementOrchestrator). Per-component
 * refs would create N engines fighting over the mic — only the first to call
 * requestPermission would be ready; the others throw "AudioEngine not ready".
 *
 * Lifecycle:
 *   - First call to useAudioEngine() constructs the AudioEngine. Constructor
 *     does NOT touch AudioContext (CAL-03 — context is created inside the
 *     user-gesture handler that calls requestPermission()).
 *   - All subsequent calls return the same instance.
 *   - The engine lives for the full tab lifetime. There is no programmatic
 *     dispose path; the only "teardown" is via window.__noisiumDisposeEngine
 *     (registered by MicPanel) which CrossDayModal calls on "Start fresh".
 *     That handler creates a fresh engine via __noisiumResetEngine below.
 *
 * Status callback uses useAppStore.setState directly — module scope can't
 * read React selectors, so we use the imperative store API. Functionally
 * identical to setMicPermission/setMicDeviceId/setAudioReady actions.
 */
let sharedEngine: AudioEngine | null = null;

function ensureEngine(): AudioEngine {
  if (!sharedEngine) {
    sharedEngine = new AudioEngine((status) => {
      useAppStore.setState({
        micPermission: status.permission,
        micDeviceId: status.deviceId,
        audioReady: status.audioReady,
      });
    });
  }
  return sharedEngine;
}

/**
 * Disposes the current engine and lets the next useAudioEngine() call build
 * a fresh one. Used by CrossDayModal's "Start fresh" path so the OS mic
 * indicator is released and any subsequent grant is treated as a clean start.
 */
export function resetAudioEngine() {
  if (sharedEngine) {
    sharedEngine.dispose();
    sharedEngine = null;
  }
}

export function useAudioEngine() {
  // ensureEngine is safe to call during render — it's idempotent and side
  // effects (constructing the class, attaching the status callback) happen
  // exactly once across all consumers.
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = ensureEngine();
  return engineRef;
}
