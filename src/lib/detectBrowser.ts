export type BrowserBucket = 'chromium' | 'firefox' | 'safari';

/**
 * Detect which of the three target browser families is running.
 * Used to render correct mic-permission recovery copy.
 *
 * Strategy:
 *   - userAgentData is present in Chrome/Edge/Brave (Chromium) only.
 *     It is NOT in Firefox or Safari (confirmed 2026).
 *   - After ruling out Chromium, Firefox is identified by 'Firefox/' in UA.
 *   - Anything else falls back to 'safari' — the safe default since Safari's
 *     copy ("Open Safari → Settings…") is the most generic.
 */
export function detectBrowser(): BrowserBucket {
  // Read in a way that's mockable in tests
  const nav = globalThis.navigator;
  // userAgentData is the most reliable Chromium signal
  // (Firefox and Safari do not implement it as of 2026)
  // @ts-expect-error — userAgentData not in lib.dom yet for all TS configs
  if (typeof nav.userAgentData !== 'undefined' && nav.userAgentData !== null) {
    return 'chromium';
  }
  const ua = nav.userAgent ?? '';
  if (ua.includes('Firefox/')) return 'firefox';
  return 'safari';
}

export function recoveryInstructions(bucket: BrowserBucket): string {
  switch (bucket) {
    case 'chromium':
      return 'Click the padlock icon in the address bar and set Microphone to Allow.';
    case 'firefox':
      return 'Click the camera icon to the left of the URL and grant microphone access.';
    case 'safari':
      return 'Open Safari → Settings → Websites → Microphone, and set this site to Allow.';
  }
}
