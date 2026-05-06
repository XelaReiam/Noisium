import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useAppStore } from '../store/useAppStore';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { getNoisiumChannel } from '../lib/broadcastChannel';

type CalibrateState =
  | { phase: 'idle' }
  | { phase: 'countdown'; value: 3 | 2 | 1 }
  | { phase: 'capturing' }
  | { phase: 'done' }
  | { phase: 'error'; message: string };

const CONFIRMATION_DURATION_MS = 1500;

/**
 * Standalone Calibrate / Recalibrate button. Lives below the MicPanel in HostView.
 *
 * Disabled until:
 *   - micPermission === 'granted' (helper text: "Enable microphone to calibrate")
 *   - AND demos.length >= 1     (helper text: "Add a demo to enable calibration")
 *   - AND no measurement is currently running
 *
 * Click flow:
 *   1. Local 3-2-1 countdown alongside the button (1s per digit). Live VU meter
 *      keeps animating in the MicPanel — the host can confirm the mic is alive.
 *   2. Call engine.calibrate() — which is engine.startMeasurement(3) under the hood.
 *      Engine handles the actual 3-second capture window.
 *   3. Write calibrationAmbientDb via store.setCalibrationAmbient(...).
 *   4. Show "Baseline captured." for ~1.5s, then return to idle (button now reads
 *      "Recalibrate room").
 *
 * Recalibrate has NO confirmation per CONTEXT decision. Single click re-runs the
 * full flow. Existing scores keep their original deltas (no retroactive recompute) —
 * this is automatic because Score.deltaDb was computed at completeMeasure time
 * and is stored, not derived.
 */
export function CalibrateButton() {
  const engineRef = useAudioEngine();
  const micPermission = useAppStore((s) => s.micPermission);
  const demos = useAppStore((s) => s.demos);
  const calibrationAmbientDb = useAppStore((s) => s.calibrationAmbientDb);
  const measuringDemoId = useAppStore((s) => s.measuringDemoId);
  const setCalibrationAmbient = useAppStore((s) => s.setCalibrationAmbient);

  const [state, setState] = useState<CalibrateState>({ phase: 'idle' });

  // Hold timeouts for cleanup if the component unmounts mid-flow (StrictMode safe)
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((id) => clearTimeout(id));
      timeoutsRef.current = [];
    };
  }, []);

  // Disable conditions
  const noPermission = micPermission !== 'granted';
  const noDemos = demos.length === 0;
  const measurementRunning = measuringDemoId !== null;
  const inFlight = state.phase !== 'idle' && state.phase !== 'done' && state.phase !== 'error';
  const disabled = noPermission || noDemos || measurementRunning || inFlight;

  // Helper text decision (highest-priority disable wins)
  const helperText =
    noPermission
      ? 'Enable microphone to calibrate'
      : noDemos
        ? 'Add a demo to enable calibration'
        : '';

  const label =
    state.phase === 'capturing'
      ? 'Calibrating…'
      : state.phase === 'done'
        ? 'Baseline captured.'
        : calibrationAmbientDb !== null
          ? 'Recalibrate room'
          : 'Calibrate room';

  async function handleClick(): Promise<void> {
    if (disabled || !engineRef.current) return;

    // Broadcast calibration start to projector. The projector renders the
    // wordmark + "Setting up…" corner status. Direct post (not via the store
    // → BroadcastBridge derivation path) because calibration is a UI-owned
    // atomic flow.
    getNoisiumChannel().postMessage({ phase: 'calibrating' });

    // 1. Inline 3-2-1 countdown (1 second per digit)
    setState({ phase: 'countdown', value: 3 });
    timeoutsRef.current.push(
      window.setTimeout(() => setState({ phase: 'countdown', value: 2 }), 1000),
    );
    timeoutsRef.current.push(
      window.setTimeout(() => setState({ phase: 'countdown', value: 1 }), 2000),
    );

    // 2. After 3s of countdown, transition to capturing and call engine.calibrate()
    const captureTimer = window.setTimeout(async () => {
      setState({ phase: 'capturing' });
      try {
        if (!engineRef.current) {
          setState({ phase: 'error', message: 'Audio engine not ready.' });
          return;
        }
        const { ambientDbFs } = await engineRef.current.calibrate();
        setCalibrationAmbient(ambientDbFs);
        setState({ phase: 'done' });
        // Brief inline confirmation, then return to idle on host AND projector
        timeoutsRef.current.push(
          window.setTimeout(() => {
            setState({ phase: 'idle' });
            getNoisiumChannel().postMessage({ phase: 'idle' });
          }, CONFIRMATION_DURATION_MS),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Calibration failed.';
        setState({ phase: 'error', message });
        // Calibration failed — return projector to idle (no audience-visible
        // hint that something went wrong; host sees the error in the inline UI).
        getNoisiumChannel().postMessage({ phase: 'idle' });
        timeoutsRef.current.push(
          window.setTimeout(() => setState({ phase: 'idle' }), 2500),
        );
      }
    }, 3000);
    timeoutsRef.current.push(captureTimer);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={clsx(
          'px-4 py-2 rounded text-sm font-medium transition-colors',
          disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-gray-900 text-white hover:bg-gray-800',
        )}
        aria-live="polite"
      >
        {label}
      </button>

      {/* Inline status indicator */}
      {state.phase === 'countdown' && (
        <span
          aria-live="assertive"
          className="font-mono text-2xl tabular-nums text-gray-700"
        >
          {state.value}
        </span>
      )}
      {state.phase === 'capturing' && (
        <span className="text-sm text-gray-600">Calibrating room — keep quiet</span>
      )}
      {state.phase === 'error' && (
        <span className="text-sm text-red-700">{state.message}</span>
      )}
      {state.phase === 'idle' && helperText && (
        <span className="text-xs text-gray-500">{helperText}</span>
      )}
    </div>
  );
}
