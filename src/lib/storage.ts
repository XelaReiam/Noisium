/**
 * Probe localStorage availability.
 *
 * Returns true if a write/remove cycle succeeds. Returns false in browsers/modes
 * that block persistence (Firefox private, Safari private). Chrome incognito and
 * Edge InPrivate allow localStorage and will return true.
 *
 * Adapted from MDN's storageAvailable() pattern:
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
 *
 * Safari private mode quirk: localStorage exists but setItem throws
 * QuotaExceededError with length === 0 (the storage is real but quota is 0).
 * We treat this as "unavailable". A genuinely-full localStorage in normal mode
 * also throws QuotaExceededError but with length > 0 — that we treat as
 * "available" since persistence does work, the user just needs to free space.
 */
export function isLocalStorageAvailable(): boolean {
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
    const testKey = '__noisium_probe__';
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  } catch (e) {
    return (
      e instanceof DOMException &&
      e.name === 'QuotaExceededError' &&
      storage !== undefined &&
      storage.length !== 0
    );
  }
}
