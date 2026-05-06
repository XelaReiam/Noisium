import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useAppStore } from '../store/useAppStore';
import { useAudioEngine } from '../hooks/useAudioEngine';

type CalibrateState =
  | { phase: 'idle' }
  | { phase: 'countdown'; value: 3 | 2 | 1 }
  | { phase: 'capturing' }
  | { phase: 'done'; stable: boolean }
  | { phase: 'error'; message: string };

const CONFIRMATION_DURATION_MS = 1500;

/**
 * Standalone Calibrate / Recalibrate button. Lives below the MicPanel in HostView.
 *
 * Disabled until:
 *   - micPermission === 'granted' (helper text: "Enable microphone to calibrate")
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
  const calibrationAmbientDb = useAppStore((s) => s.calibrationAmbientDb);
  const measuringDemoId = useAppStore((s) => s.measuringDemoId);
  const setCalibrationAmbient = useAppStore((s) => s.setCalibrationAmbient);
  const setMeasurePhase = useAppStore((s) => s.setMeasurePhase);

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
  const measurementRunning = measuringDemoId !== null;
  const inFlight = state.phase !== 'idle' && state.phase !== 'done' && state.phase !== 'error';
  const disabled = noPermission || measurementRunning || inFlight;

  // Helper text decision
  const helperText = noPermission ? 'Enable microphone to calibrate' : '';

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

    // Signal calibrating state to the store; BroadcastBridge derives and
    // broadcasts { phase: 'calibrating' } to the projector automatically.
    setMeasurePhase('calibrating');

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
        const { ambientDbFs, stableBaseline } = await engineRef.current.calibrate();
        setCalibrationAmbient(ambientDbFs);
        setState({ phase: 'done', stable: stableBaseline });
        // Brief inline confirmation, then return to idle; store write triggers
        // BroadcastBridge to broadcast { phase: 'idle' } to the projector.
        timeoutsRef.current.push(
          window.setTimeout(() => {
            setState({ phase: 'idle' });
            if (useAppStore.getState().measurePhase === 'calibrating') {
              setMeasurePhase('idle');
            }
          }, CONFIRMATION_DURATION_MS),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Calibration failed.';
        setState({ phase: 'error', message });
        // Return projector to idle; BroadcastBridge derives { phase: 'idle' }
        // from the store write — no audience-visible error hint on projector.
        setMeasurePhase('idle');
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
      {state.phase === 'done' && !state.stable && (
        <span className="text-sm text-amber-700">Room was noisy — recalibrate when quieter</span>
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
