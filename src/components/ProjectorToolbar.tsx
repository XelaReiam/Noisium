import { clsx } from 'clsx';
import { useAppStore, type AppState } from '../store/useAppStore';

/**
 * Compact host header element. Two pieces:
 *   1. "Open projector" button — calls window.open('#/projector', '_blank')
 *   2. Status indicator — dot + text driven by connection state
 *
 * Dual-mode display logic (CONN-02):
 *   - lanModeEnabled=false (broadcast mode): uses projectorConnected heartbeat.
 *     Identical to v1.1 behaviour.
 *   - lanModeEnabled=true (LAN mode): uses wsConnectionStatus from the store,
 *     showing all five states: idle/disconnected → red "Projector disconnected",
 *     waiting → amber "Waiting for projector",
 *     connected → green "Projector connected",
 *     reconnecting → amber "Reconnecting…"
 */

const STATUS_LABELS: Record<AppState['wsConnectionStatus'], string> = {
  idle:         'Projector disconnected',
  waiting:      'Waiting for projector',
  connected:    'Projector connected',
  disconnected: 'Projector disconnected',
  reconnecting: 'Reconnecting…',
};

export function ProjectorToolbar() {
  const projectorConnected = useAppStore((s) => s.projectorConnected);
  const lanModeEnabled = useAppStore((s) => s.lanModeEnabled);
  const wsConnectionStatus = useAppStore((s) => s.wsConnectionStatus);

  function handleOpenProjector(): void {
    window.open('#/projector', '_blank');
  }

  const statusText = lanModeEnabled
    ? STATUS_LABELS[wsConnectionStatus]
    : projectorConnected ? 'Projector connected' : 'Projector disconnected';

  const dotColor = lanModeEnabled
    ? wsConnectionStatus === 'connected'
      ? 'bg-green-500'
      : wsConnectionStatus === 'waiting' || wsConnectionStatus === 'reconnecting'
        ? 'bg-amber-400'
        : 'bg-red-400'
    : projectorConnected ? 'bg-green-500' : 'bg-red-400';

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
          className={clsx('inline-block w-2 h-2 rounded-full', dotColor)}
          data-testid="projector-status-dot"
        />
        {statusText}
      </span>
    </div>
  );
}
