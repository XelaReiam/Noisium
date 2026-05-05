import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

interface Props {
  /**
   * AbortController.signal-issuing function. The orchestrator owns the
   * AbortController for the active measurement and exposes a way to call
   * .abort() on it. The guard fires this when device-change is detected
   * during the active measurement window.
   *
   * Why pass a function instead of the controller object: the controller
   * is replaced for each measurement run (a new one is constructed every
   * time MeasurementOrchestrator starts a window). Passing a function lets
   * the guard always abort the LATEST controller without React-state thrash.
   */
  abort: () => void;
}

/**
 * Listens to navigator.mediaDevices.devicechange while a measurement is active
 * (measuringDemoId !== null). On a device-change that removes the active
 * audio-input device, calls abort() — which the orchestrator will translate
 * into store.abortMeasure(demoId, 'device-change').
 *
 * The audioContext.statechange abort path lives INSIDE engine.startMeasurement()
 * itself (Plan 03-03 Pattern 1) — it doesn't go through this guard.
 *
 * Render-null pattern matches CrossDayCheckEffect from Phase 1 — keeps the
 * effect isolated from any presentational tree.
 */
export function MeasurementAbortGuard({ abort }: Props) {
  const measuringDemoId = useAppStore((s) => s.measuringDemoId);

  useEffect(() => {
    if (!measuringDemoId) return;
    if (!navigator.mediaDevices) return;

    const onDeviceChange = async (): Promise<void> => {
      // RESEARCH Pitfall 8: read live state via getState() to avoid stale
      // closure values. The active device might have changed during the
      // measurement (no — that's exactly what triggered this event handler).
      const activeId = useAppStore.getState().micDeviceId;
      if (!activeId) {
        // No active device tracked — assume worst case and abort
        abort();
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((d) => d.kind === 'audioinput');
        if (!audioInputs.some((d) => d.deviceId === activeId)) {
          abort();
        }
      } catch {
        // enumerateDevices threw — be defensive and abort
        abort();
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measuringDemoId]);

  return null;
}
