/**
 * Subset of MediaTrackSettings we actually inspect.
 * Browsers may omit any of these (Safari notably omits autoGainControl).
 */
export interface AgcRelevantSettings {
  autoGainControl?: boolean;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
}

/**
 * Pure verification: returns the names of constraints that ARE STILL ENABLED
 * despite being requested as false.
 *
 * SAFARI NOTE: Safari does not implement `autoGainControl` (WebKit bug #204444,
 * NEW as of 2026) and does not return it in `track.getSettings()`. We must NOT
 * warn when the property is `undefined` — only when it is explicitly `=== true`.
 * Otherwise Safari produces a permanent false-positive.
 *
 * The logger lives in AudioEngine; this function stays pure for testability.
 */
export function verifyAgcConstraints(settings: AgcRelevantSettings): string[] {
  const issues: string[] = [];
  if (settings.autoGainControl === true) issues.push('autoGainControl');
  if (settings.echoCancellation === true) issues.push('echoCancellation');
  if (settings.noiseSuppression === true) issues.push('noiseSuppression');
  return issues;
}
