import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { CountdownOverlay } from './CountdownOverlay';
import { MeasurementAbortGuard } from './MeasurementAbortGuard';

type OverlayPhase =
  | { kind: 'countdown'; value: 3 | 2 | 1 }
  | { kind: 'measuring'; demoName: string }
  | { kind: 'aborted'; message: string };

/**
 * Render-effect component owning the measurement run. Subscribes to
 * `measuringDemoId` from the store; when it transitions from null → string,
 * runs the full flow:
 *
 *   1. 3-2-1 countdown (3 seconds, 1s per digit) — overlay shows the number
 *   2. engine.startMeasurement(windowSeconds, signal) — overlay shows "Measuring [name]"
 *   3a. Promise resolves with avgDbFs → store.completeMeasure(...) → overlay clears
 *   3b. Promise resolves with abort → store.abortMeasure(...) → overlay shows AbortWarning
 *
 * Owns:
 *   - The local AbortController (one per run)
 *   - The 3-2-1 setTimeout chain (cleared if anything aborts mid-countdown)
 *   - Local OverlayPhase state (drives CountdownOverlay)
 *
 * Composes the MeasurementAbortGuard (devicechange) — the guard calls our
 * controllerRef.current?.abort() to terminate the engine's startMeasurement
 * promise, then the engine returns aborted: 'manual', and we map that to the
 * appropriate store.abortMeasure reason via a tracking ref.
 */
export function MeasurementOrchestrator() {
  const engineRef = useAudioEngine();
  const measuringDemoId = useAppStore((s) => s.measuringDemoId);
  const abortMessage = useAppStore((s) => s.abortMessage);
  const demos = useAppStore((s) => s.demos);
  const windowSeconds = useAppStore((s) => s.windowSeconds);
  const completeMeasure = useAppStore((s) => s.completeMeasure);
  const abortMeasure = useAppStore((s) => s.abortMeasure);
  const clearAbort = useAppStore((s) => s.clearAbort);
  const startMeasure = useAppStore((s) => s.startMeasure);
  const setMeasurePhase = useAppStore((s) => s.setMeasurePhase);

  const controllerRef = useRef<AbortController | null>(null);
  // Tracks why the controller was aborted so we can map 'manual' from the engine
  // to a more specific store reason ('device-change' from the AbortGuard, or
  // 'manual' from the cleanup path).
  const abortReasonRef = useRef<'device-change' | 'manual' | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const [overlayPhase, setOverlayPhase] = useState<OverlayPhase | null>(null);

  // Stable abort callback for the AbortGuard
  const abortFromDeviceChange = useCallback(() => {
    abortReasonRef.current = 'device-change';
    controllerRef.current?.abort();
  }, []);

  // Main effect: drives the run when measuringDemoId is set
  useEffect(() => {
    if (!measuringDemoId) {
      // measuringDemoId became null → run completed or was reset; clear overlay
      // unless the abort warning is showing
      if (!abortMessage) setOverlayPhase(null);
      return;
    }
    const demo = demos.find((d) => d.id === measuringDemoId);
    const demoName = demo?.name ?? 'demo';

    // Fresh AbortController for this run
    const controller = new AbortController();
    controllerRef.current = controller;
    abortReasonRef.current = null;

    // Phase 1: 3-2-1 countdown (3 seconds total)
    // Broadcast countdown phase to projector via BroadcastBridge
    setMeasurePhase('countdown');
    setOverlayPhase({ kind: 'countdown', value: 3 });
    timeoutsRef.current.push(
      window.setTimeout(() => setOverlayPhase({ kind: 'countdown', value: 2 }), 1000),
    );
    timeoutsRef.current.push(
      window.setTimeout(() => setOverlayPhase({ kind: 'countdown', value: 1 }), 2000),
    );

    let cancelled = false;
    timeoutsRef.current.push(
      window.setTimeout(async () => {
        if (cancelled) return;
        // Phase 2: capture window
        // Broadcast measuring phase to projector
        setMeasurePhase('measuring');
        setOverlayPhase({ kind: 'measuring', demoName });
        try {
          if (!engineRef.current) {
            abortMeasure(measuringDemoId, 'manual');
            return;
          }
          const result = await engineRef.current.startMeasurement(
            windowSeconds,
            controller.signal,
          );
          if (cancelled) return;
          if (result.aborted === false) {
            // Briefly hold in window-end phase so the projector shows "Thank you."
            // BroadcastBridge derives { phase: 'window-end' } from this state and
            // posts it. After WINDOW_END_HOLD_MS, we commit the score, which
            // moves the store to measurePhase='idle' and triggers the idle
            // broadcast. The projector's own window-end → idle transition (also
            // ~1200ms) lands harmoniously.
            setMeasurePhase('window-end');
            // BroadcastBridge subscribes to the store and derives
            // { phase: 'window-end', demoName } automatically from this write.
            const WINDOW_END_HOLD_MS = 1200;
            timeoutsRef.current.push(
              window.setTimeout(() => {
                if (cancelled) return;
                completeMeasure(measuringDemoId, result.avgDbFs);
                setOverlayPhase(null);
              }, WINDOW_END_HOLD_MS),
            );
          } else {
            // The engine reports 'manual' when our AbortController fires.
            // Map to the more specific reason from abortReasonRef if set.
            const reason =
              result.reason === 'manual' && abortReasonRef.current
                ? abortReasonRef.current
                : result.reason;
            abortMeasure(measuringDemoId, reason);
            // overlayPhase is set to 'aborted' via the abortMessage observer effect
          }
        } catch (err) {
          if (cancelled) return;
          // Engine threw (e.g. analyser not ready) — store as manual abort
          console.error('[Noisium] startMeasurement threw:', err);
          abortMeasure(measuringDemoId, 'manual');
        }
      }, 3000),
    );

    return () => {
      // Cleanup: cancel any in-flight run.
      cancelled = true;
      timeoutsRef.current.forEach((id) => clearTimeout(id));
      timeoutsRef.current = [];
      // If the controller hasn't aborted yet (e.g. unmount mid-run), abort it
      // so the engine cleans up its setInterval + listeners.
      if (controllerRef.current && !controllerRef.current.signal.aborted) {
        abortReasonRef.current = abortReasonRef.current ?? 'manual';
        controllerRef.current.abort();
      }
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measuringDemoId]);

  // Observer effect: when abortMessage becomes non-null while we have a
  // measuringDemoId of null (the abort already cleared it), show the abort
  // warning overlay. When abortMessage clears, hide the overlay.
  useEffect(() => {
    if (abortMessage) {
      setOverlayPhase({ kind: 'aborted', message: abortMessage });
    } else if (overlayPhase?.kind === 'aborted') {
      setOverlayPhase(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abortMessage]);

  function handleRetry(): void {
    // Read the demo id that was being measured before the abort. The store
    // tracks this via abortedDemoId.
    const abortedDemoId = useAppStore.getState().abortedDemoId;
    clearAbort();
    if (abortedDemoId) {
      // Retry: kick off a fresh measurement run. The store's startMeasure
      // defensively clears redoConfirmDemoId, abortedDemoId, abortMessage —
      // no stale UI state.
      startMeasure(abortedDemoId);
    }
  }

  function handleDismissAbort(): void {
    clearAbort();
    // Demo returns to Pending automatically (getDemoStatus reads abortedDemoId)
  }

  return (
    <>
      {overlayPhase && (
        <CountdownOverlay
          phase={overlayPhase}
          onRetry={handleRetry}
          onDismiss={handleDismissAbort}
        />
      )}
      <MeasurementAbortGuard abort={abortFromDeviceChange} />
    </>
  );
}
