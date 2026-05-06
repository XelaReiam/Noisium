/**
 * Module-level BroadcastChannel singleton for the 'noisium' channel.
 *
 * Why module-level (not per-component): React StrictMode double-mounts effects.
 * If `new BroadcastChannel('noisium')` were called inside `useEffect`, two
 * channels would coexist temporarily during cleanup→remount, each delivering
 * the same messages — every send would be doubled in the receiver.
 *
 * Mirrors the AudioEngine module-level singleton pattern from Phase 3 Plan 06.
 */

const CHANNEL_NAME = 'noisium';

let _channel: BroadcastChannel | null = null;

export function getNoisiumChannel(): BroadcastChannel {
  if (!_channel) {
    _channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return _channel;
}

/** Test-only: closes the current channel and lets the next call build a fresh one. */
export function resetNoisiumChannel(): void {
  _channel?.close();
  _channel = null;
}
