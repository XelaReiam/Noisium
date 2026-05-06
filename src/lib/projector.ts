/**
 * Pure-function library for the host→projector BroadcastChannel surface.
 *
 * No React, no Web Audio, no Zustand — every function here is deterministic
 * and synchronously testable in jsdom.
 *
 * Imported by:
 *   - src/components/BroadcastBridge.tsx       → deriveProjectorMessage (host-side sender)
 *   - src/components/ProjectorView.tsx         → ProjectorMessage type
 *   - src/components/HostView.tsx              → canRevealWinner (button gating)
 *   - src/store/useAppStore.ts (triggerReveal) → deriveWinner (when host clicks Reveal)
 *
 * PRIVACY INVARIANT: No variant of ProjectorMessage carries a numeric score
 * field. The type itself enforces PROJ-02 — even if a future PR added a `score`
 * to one variant, every receiver would need a code change to read it. The
 * structural barrier is intentional belt-and-suspenders on top of the dev-
 * discipline rule.
 */

import type { Score } from './measurement';

// ============================================================================
// Types
// ============================================================================

/**
 * Discriminated union of messages broadcast on the 'noisium' channel.
 *
 * The `'reveal-buildup'` variant is part of the locked CONTEXT.md union but is
 * PROJECTOR-INTERNAL ONLY — the host never posts it. Per 04-RESEARCH.md Pitfall 4,
 * the buildup→name animation runs from a local timer on the projector side
 * (triggered when the projector receives `{ phase: 'reveal' }`). The variant
 * is included in the type so the projector's exhaustive switch is total and
 * so any future projector-internal channel reuse type-checks. The host-side
 * `deriveProjectorMessage` function MUST never return this variant (asserted
 * by a unit test below).
 */
export type ProjectorMessage =
  | { phase: 'idle' }
  | { phase: 'calibrating' }
  | { phase: 'countdown'; demoName: string; countdownSeconds: number }
  | { phase: 'measuring'; demoName: string; remainingSeconds: number }
  | { phase: 'window-end'; demoName: string }
  | { phase: 'reveal-buildup' } // Projector-internal only — host never posts this; reserved for projector's display state machine
  | { phase: 'reveal'; winner: { name: string } | { names: string[] } }
  | { phase: 'heartbeat-host' };

/** Messages the projector posts back to the host. */
export type ProjectorReplyMessage =
  | { phase: 'heartbeat-projector' }
  | { phase: 'request-state' };

/**
 * Slice of AppState the deriver reads. Lifting this out of useAppStore avoids
 * a circular import and makes deriveProjectorMessage trivially testable.
 */
export interface ProjectorMessageState {
  demos: { id: string; name: string }[];
  measuringDemoId: string | null;
  measurePhase: 'idle' | 'countdown' | 'measuring' | 'window-end';
  windowSeconds: number;
  revealActive: boolean;
  revealWinner: { name: string } | { names: string[] } | null;
}

// ============================================================================
// deriveWinner — computes the highest-delta-dB demo or a tie set
// ============================================================================

/**
 * Pure derivation: given the demo list, the score map, and the skip set,
 * produce the winner payload (or null if no measured-non-skipped demos exist).
 *
 * Tie semantics: any demos sharing the maximum deltaDb produce a `{ names: [...] }`
 * payload. Floating-point equality (`===`) is safe here because deltaDb values
 * are stored as-is at completeMeasure time — there is no later arithmetic that
 * would introduce drift between two truly-equal results.
 */
export function deriveWinner(
  demos: readonly { id: string; name: string }[],
  scores: Readonly<Record<string, Score>>,
  skippedDemoIds: readonly string[],
): { name: string } | { names: string[] } | null {
  const skipSet = new Set(skippedDemoIds);
  const candidates = demos.filter(
    (d) => scores[d.id] !== undefined && !skipSet.has(d.id),
  );
  if (candidates.length === 0) return null;

  const maxDelta = Math.max(...candidates.map((d) => scores[d.id].deltaDb));
  const winners = candidates.filter((d) => scores[d.id].deltaDb === maxDelta);

  if (winners.length === 1) return { name: winners[0].name };
  return { names: winners.map((w) => w.name) };
}

// ============================================================================
// canRevealWinner — gates the "Reveal winner" button on host
// ============================================================================

/**
 * Reveal is allowed iff:
 *   - There is at least one demo
 *   - At least one demo is measured (scores has any entries)
 *   - Every non-skipped demo has been measured (no Pending non-skipped left)
 */
export function canRevealWinner(
  demos: readonly { id: string; name: string }[],
  scores: Readonly<Record<string, Score>>,
  skippedDemoIds: readonly string[],
): boolean {
  if (demos.length === 0) return false;
  const skipSet = new Set(skippedDemoIds);
  const nonSkipped = demos.filter((d) => !skipSet.has(d.id));
  if (nonSkipped.length === 0) return false; // all skipped — nothing to reveal
  return nonSkipped.every((d) => scores[d.id] !== undefined);
}

// ============================================================================
// deriveProjectorMessage — turns AppState into the projector-safe payload
// ============================================================================

/**
 * Reads from a minimal store slice and produces the appropriate ProjectorMessage.
 *
 * Precedence (highest first):
 *   1. revealActive + revealWinner present → 'reveal' (buildup animates on projector)
 *   2. measuringDemoId set → countdown / measuring / window-end (per measurePhase)
 *   3. otherwise → 'idle' (the wordmark default)
 *
 * NOT covered here:
 *   - 'calibrating': sent imperatively by CalibrateButton (Plan 04 wires this) —
 *     calibration is an atomic UI transition that doesn't need to round-trip
 *     through Zustand.
 *   - 'heartbeat-host': sent on a setInterval by BroadcastBridge — not a
 *     state-derived message.
 */
export function deriveProjectorMessage(state: ProjectorMessageState): ProjectorMessage {
  // Reveal takes top priority — once host triggers it, projector should show
  // the buildup → name regardless of any other state.
  if (state.revealActive && state.revealWinner !== null) {
    return { phase: 'reveal', winner: state.revealWinner };
  }

  // Active measurement sub-phases
  if (state.measuringDemoId !== null) {
    const demo = state.demos.find((d) => d.id === state.measuringDemoId);
    const demoName = demo?.name ?? 'demo';
    switch (state.measurePhase) {
      case 'countdown':
        // countdownSeconds: the projector counts down locally on receipt.
        // Re-sending on each tick is unnecessary — sub-millisecond latency
        // within the same browser plus a local timer give perfect sync.
        return { phase: 'countdown', demoName, countdownSeconds: 3 };
      case 'measuring':
        return { phase: 'measuring', demoName, remainingSeconds: state.windowSeconds };
      case 'window-end':
        return { phase: 'window-end', demoName };
      case 'idle':
        // Edge: measuringDemoId was just set but measurePhase hasn't transitioned
        // yet (or has been reset on abort). Fall through to idle.
        break;
    }
  }

  return { phase: 'idle' };
}
