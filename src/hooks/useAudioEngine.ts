import { useEffect, useRef } from 'react';
import { AudioEngine } from '../lib/audioEngine';
import { useAppStore } from '../store/useAppStore';

/**
 * React hook that owns a single AudioEngine instance per host tab.
 *
 * Lifecycle:
 *   - On first mount: construct AudioEngine. Constructor does NOT touch
 *     AudioContext (CAL-03 — context is created later inside the user
 *     gesture handler that calls engineRef.current.requestPermission()).
 *   - The engine's status callback is wired to Zustand setters so any UI
 *     that subscribes to micPermission / micDeviceId / audioReady
 *     re-renders automatically.
 *   - On unmount: dispose. AudioEngine.dispose() is idempotent so StrictMode
 *     double-mount in dev (mount → unmount → mount) is safe.
 *
 * Returns a ref pointing to the engine. Consumers call methods on
 * engineRef.current — they NEVER read currentLevel through React state
 * (that lives on the class instance and is read by LevelIndicator's own rAF).
 */
export function useAudioEngine() {
  const setMicPermission = useAppStore((s) => s.setMicPermission);
  const setMicDeviceId = useAppStore((s) => s.setMicDeviceId);
  const setAudioReady = useAppStore((s) => s.setAudioReady);

  const engineRef = useRef<AudioEngine | null>(null);

  useEffect(() => {
    const engine = new AudioEngine((status) => {
      setMicPermission(status.permission);
      setMicDeviceId(status.deviceId);
      setAudioReady(status.audioReady);
    });
    engineRef.current = engine;

    return () => {
      // StrictMode dev double-mount: dispose runs on first unmount, second
      // mount creates a fresh engine. AudioEngine.dispose is idempotent.
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // setters are store-stable; one-time mount lifecycle

  return engineRef;
}
