import { useAppStore } from '../store/useAppStore';

/**
 * LanModeToggle — host-side control for Local Network Mode.
 *
 * When LAN mode is off: renders only the toggle (BroadcastChannel is in use).
 * When LAN mode is on: renders the toggle + projector URL for the LAN device.
 *
 * URL derivation: when the CLI server injects window.__NOISIUM_LAN_URL__ (so
 * the URL points at the LAN IP, not localhost), prefer it. Otherwise fall back
 * to window.location — fine in jsdom and on GitHub Pages.
 */
export function LanModeToggle() {
  const lanModeEnabled = useAppStore((s) => s.lanModeEnabled);
  const setLanModeEnabled = useAppStore((s) => s.setLanModeEnabled);

  const injectedLanUrl = (window as unknown as Record<string, unknown>)['__NOISIUM_LAN_URL__'];
  const basePath = window.location.pathname.replace(/\/$/, '');
  const projectorUrl =
    typeof injectedLanUrl === 'string' && injectedLanUrl.length > 0
      ? `${injectedLanUrl}/#/projector`
      : `${window.location.protocol}//${window.location.host}${basePath}/#/projector`;

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
