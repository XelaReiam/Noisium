import { AbortWarning } from './AbortWarning';

type Phase =
  | { kind: 'countdown'; value: 3 | 2 | 1 }
  | { kind: 'measuring'; demoName: string }
  | { kind: 'aborted'; message: string };

interface Props {
  phase: Phase;
  onRetry: () => void;
  onDismiss: () => void;
}

/**
 * Full-area takeover overlay for measurement. Pure presentation:
 * receives the current phase + callbacks and renders the JSX. The orchestrator
 * (MeasurementOrchestrator) owns the timing logic.
 *
 * Phase transitions:
 *   - countdown 3 → countdown 2 → countdown 1 (1s each) — orchestrator-driven
 *   - then 'measuring' for windowSeconds (engine call running)
 *   - on completion: orchestrator unmounts this component
 *   - on abort: orchestrator switches phase to 'aborted'
 *
 * Layout:
 *   - position: absolute inset-0 over HostView's main area (HostView gives <main>
 *     a `relative` parent to anchor it).
 *   - z-10 above all main content.
 *   - White-95 backdrop covers and physically blocks all clicks beneath.
 */
export function CountdownOverlay({ phase, onRetry, onDismiss }: Props) {
  if (phase.kind === 'aborted') {
    return <AbortWarning message={phase.message} onRetry={onRetry} onDismiss={onDismiss} />;
  }

  const headlineText =
    phase.kind === 'countdown'
      ? 'Get ready — keep quiet'
      : `Measuring ${phase.demoName}`;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="absolute inset-0 z-10 bg-white/95 flex flex-col items-center justify-center gap-6 p-8"
    >
      <p className="text-lg text-gray-600 text-center">{headlineText}</p>
      <div className="text-9xl font-bold text-gray-900 tabular-nums">
        {phase.kind === 'countdown' ? (
          phase.value
        ) : (
          // Measuring phase: animated dots provide motion without a literal counter
          <span className="inline-flex items-baseline gap-2">
            <span className="animate-pulse">•</span>
            <span className="animate-pulse [animation-delay:200ms]">•</span>
            <span className="animate-pulse [animation-delay:400ms]">•</span>
          </span>
        )}
      </div>
    </div>
  );
}
