import { useAppStore } from '../store/useAppStore';

/**
 * LanModeToggle — host-side control for Local Network Mode.
 *
 * When LAN mode is off: renders only the toggle (BroadcastChannel is in use).
 * When LAN mode is on: renders the toggle + projector URL for the LAN device.
 *
 * URL derivation follows research pitfall 5: in jsdom, window.location.protocol='http:',
 * window.location.host='localhost', producing 'http://localhost/#/projector'.
 */
export function LanModeToggle() {
  const lanModeEnabled = useAppStore((s) => s.lanModeEnabled);
  const setLanModeEnabled = useAppStore((s) => s.setLanModeEnabled);

  const projectorUrl = `${window.location.protocol}//${window.location.host}/#/projector`;

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 select-none">
        <input
          type="checkbox"
          checked={lanModeEnabled}
          onChange={(e) => setLanModeEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 accent-gray-900"
        />
        Local Network Mode
      </label>
      {lanModeEnabled && (
        <p className="text-sm text-gray-600">
          Projector URL:{' '}
          <span data-testid="projector-url" className="font-mono">
            {projectorUrl}
          </span>
        </p>
      )}
    </div>
  );
}
