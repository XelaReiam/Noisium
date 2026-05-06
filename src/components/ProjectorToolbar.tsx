import { clsx } from 'clsx';
import { useAppStore } from '../store/useAppStore';

/**
 * Compact host header element. Two pieces:
 *   1. "Open projector" button — calls window.open('#/projector', '_blank')
 *   2. Status indicator — green/red dot + text driven by projectorConnected
 *
 * The status field is updated by BroadcastBridge in response to the projector's
 * heartbeat-projector messages (Plan 04-04). 5s without a heartbeat → red.
 */
export function ProjectorToolbar() {
  const projectorConnected = useAppStore((s) => s.projectorConnected);

  function handleOpenProjector(): void {
    window.open('#/projector', '_blank');
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      <button
        type="button"
        onClick={handleOpenProjector}
        className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
      >
        Open projector
      </button>
      <span
        className="flex items-center gap-1.5 text-xs text-gray-600"
        role="status"
        aria-live="polite"
      >
        <span
          aria-hidden="true"
          className={clsx(
            'inline-block w-2 h-2 rounded-full',
            projectorConnected ? 'bg-green-500' : 'bg-red-400',
          )}
          data-testid="projector-status-dot"
        />
        {projectorConnected ? 'Projector connected' : 'Projector disconnected'}
      </span>
    </div>
  );
}
