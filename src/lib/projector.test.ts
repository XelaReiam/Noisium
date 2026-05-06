import { describe, it, expect } from 'vitest';
import {
  deriveWinner,
  canRevealWinner,
  deriveProjectorMessage,
  type ProjectorMessage,
  type ProjectorMessageState,
} from './projector';
import type { Score } from './measurement';

// Helpers
const score = (deltaDb: number): Score => ({
  avgDbFs: -30,
  deltaDb,
  capturedAt: '2026-05-06T00:00:00.000Z',
});

const baseState: ProjectorMessageState = {
  demos: [],
  measuringDemoId: null,
  measurePhase: 'idle',
  windowSeconds: 8,
  revealActive: false,
  revealWinner: null,
};

describe('deriveWinner', () => {
  it('returns null for empty demos', () => {
    expect(deriveWinner([], {}, [])).toBeNull();
  });

  it('returns the single measured demo', () => {
    const demos = [{ id: 'a', name: 'Alpha' }];
    expect(deriveWinner(demos, { a: score(10) }, [])).toEqual({ name: 'Alpha' });
  });

  it('returns the demo with the higher deltaDb', () => {
    const demos = [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Bravo' },
    ];
    expect(deriveWinner(demos, { a: score(8), b: score(12) }, [])).toEqual({ name: 'Bravo' });
  });

  it('returns a tie array when two demos share max deltaDb', () => {
    const demos = [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Bravo' },
    ];
    const winner = deriveWinner(demos, { a: score(10), b: score(10) }, []);
    expect(winner).toEqual({ names: expect.arrayContaining(['Alpha', 'Bravo']) });
    if (winner && 'names' in winner) expect(winner.names).toHaveLength(2);
  });

  it('returns a tie array with three tied demos when applicable', () => {
    const demos = [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Bravo' },
      { id: 'c', name: 'Charlie' },
    ];
    const winner = deriveWinner(
      demos,
      { a: score(10), b: score(10), c: score(8) },
      [],
    );
    expect(winner).toEqual({ names: expect.arrayContaining(['Alpha', 'Bravo']) });
    if (winner && 'names' in winner) {
      expect(winner.names).toHaveLength(2);
      expect(winner.names).not.toContain('Charlie');
    }
  });

  it('excludes skipped demos from candidacy', () => {
    const demos = [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Bravo' },
    ];
    expect(deriveWinner(demos, { a: score(20), b: score(10) }, ['a'])).toEqual({
      name: 'Bravo',
    });
  });

  it('returns null when all demos are skipped', () => {
    const demos = [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Bravo' },
    ];
    expect(deriveWinner(demos, { a: score(10), b: score(10) }, ['a', 'b'])).toBeNull();
  });

  it('returns null when no demos are measured', () => {
    const demos = [{ id: 'a', name: 'Alpha' }];
    expect(deriveWinner(demos, {}, [])).toBeNull();
  });

  it('returns the maximum even when all deltas are negative', () => {
    const demos = [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Bravo' },
    ];
    expect(deriveWinner(demos, { a: score(-5), b: score(-2) }, [])).toEqual({
      name: 'Bravo',
    });
  });

  it('treats a skipped demo as excluded even if it has a score', () => {
    const demos = [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Bravo' },
    ];
    // Defensive: store keeps scores when skipping, so the skip set must override.
    expect(deriveWinner(demos, { a: score(20), b: score(5) }, ['a'])).toEqual({
      name: 'Bravo',
    });
  });
});

describe('canRevealWinner', () => {
  it('returns false for empty demos', () => {
    expect(canRevealWinner([], {}, [])).toBe(false);
  });

  it('returns false when no demos are measured', () => {
    const demos = [{ id: 'a', name: 'Alpha' }];
    expect(canRevealWinner(demos, {}, [])).toBe(false);
  });

  it('returns true when the only demo is measured', () => {
    const demos = [{ id: 'a', name: 'Alpha' }];
    expect(canRevealWinner(demos, { a: score(5) }, [])).toBe(true);
  });

  it('returns false when one non-skipped demo is unmeasured', () => {
    const demos = [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Bravo' },
    ];
    expect(canRevealWinner(demos, { a: score(5) }, [])).toBe(false);
  });

  it('returns true when remaining unmeasured demo is skipped', () => {
    const demos = [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Bravo' },
    ];
    expect(canRevealWinner(demos, { a: score(5) }, ['b'])).toBe(true);
  });

  it('returns false when all demos are skipped (nothing to reveal)', () => {
    const demos = [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Bravo' },
    ];
    expect(canRevealWinner(demos, {}, ['a', 'b'])).toBe(false);
  });
});

describe('deriveProjectorMessage', () => {
  it('returns reveal with single name winner when revealActive', () => {
    const state: ProjectorMessageState = {
      ...baseState,
      revealActive: true,
      revealWinner: { name: 'Alpha' },
    };
    expect(deriveProjectorMessage(state)).toEqual({
      phase: 'reveal',
      winner: { name: 'Alpha' },
    });
  });

  it('returns reveal with names array when winner is a tie', () => {
    const state: ProjectorMessageState = {
      ...baseState,
      revealActive: true,
      revealWinner: { names: ['Alpha', 'Bravo'] },
    };
    expect(deriveProjectorMessage(state)).toEqual({
      phase: 'reveal',
      winner: { names: ['Alpha', 'Bravo'] },
    });
  });

  it('falls back to idle when revealActive but winner is null (defensive)', () => {
    const state: ProjectorMessageState = {
      ...baseState,
      revealActive: true,
      revealWinner: null,
    };
    expect(deriveProjectorMessage(state)).toEqual({ phase: 'idle' });
  });

  it('returns countdown payload during measurePhase=countdown', () => {
    const state: ProjectorMessageState = {
      ...baseState,
      demos: [{ id: 'a', name: 'Alpha' }],
      measuringDemoId: 'a',
      measurePhase: 'countdown',
    };
    expect(deriveProjectorMessage(state)).toEqual({
      phase: 'countdown',
      demoName: 'Alpha',
      countdownSeconds: 3,
    });
  });

  it('returns measuring payload with windowSeconds during measurePhase=measuring', () => {
    const state: ProjectorMessageState = {
      ...baseState,
      demos: [{ id: 'a', name: 'Alpha' }],
      measuringDemoId: 'a',
      measurePhase: 'measuring',
      windowSeconds: 10,
    };
    expect(deriveProjectorMessage(state)).toEqual({
      phase: 'measuring',
      demoName: 'Alpha',
      remainingSeconds: 10,
    });
  });

  it('returns window-end payload during measurePhase=window-end', () => {
    const state: ProjectorMessageState = {
      ...baseState,
      demos: [{ id: 'a', name: 'Alpha' }],
      measuringDemoId: 'a',
      measurePhase: 'window-end',
    };
    expect(deriveProjectorMessage(state)).toEqual({
      phase: 'window-end',
      demoName: 'Alpha',
    });
  });

  it('falls back to demoName="demo" when measuringDemoId is not in demos[]', () => {
    const state: ProjectorMessageState = {
      ...baseState,
      demos: [],
      measuringDemoId: 'orphan-id',
      measurePhase: 'measuring',
      windowSeconds: 8,
    };
    expect(deriveProjectorMessage(state)).toEqual({
      phase: 'measuring',
      demoName: 'demo',
      remainingSeconds: 8,
    });
  });

  it('returns idle when measuringDemoId set but measurePhase=idle', () => {
    const state: ProjectorMessageState = {
      ...baseState,
      demos: [{ id: 'a', name: 'Alpha' }],
      measuringDemoId: 'a',
      measurePhase: 'idle',
    };
    expect(deriveProjectorMessage(state)).toEqual({ phase: 'idle' });
  });

  it('returns idle for the default state', () => {
    expect(deriveProjectorMessage(baseState)).toEqual({ phase: 'idle' });
  });
});

describe('privacy invariant: no scores ever in ProjectorMessage', () => {
  // Build every concrete variant the host could emit and stringify it.
  const messages: ProjectorMessage[] = [
    { phase: 'idle' },
    { phase: 'calibrating' },
    { phase: 'countdown', demoName: 'Alpha', countdownSeconds: 3 },
    { phase: 'measuring', demoName: 'Alpha', remainingSeconds: 8 },
    { phase: 'window-end', demoName: 'Alpha' },
    { phase: 'reveal-buildup' },
    { phase: 'reveal', winner: { name: 'Alpha' } },
    { phase: 'reveal', winner: { names: ['Alpha', 'Bravo'] } },
    { phase: 'heartbeat-host' },
  ];

  it.each(messages)('variant $phase has no score-bearing fields', (msg) => {
    const json = JSON.stringify(msg);
    expect(json).not.toMatch(/score/i);
    expect(json).not.toMatch(/deltaDb/i);
    expect(json).not.toMatch(/avgDbFs/i);
  });
});

describe('host invariant: deriveProjectorMessage never returns reveal-buildup', () => {
  // The 'reveal-buildup' variant is projector-internal. The host-side deriver
  // must never produce it, regardless of state combination. This test sweeps
  // every meaningful state combination and asserts the invariant.
  it('never returns phase: "reveal-buildup" for any state combination', () => {
    const demos = [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Bravo' },
    ];
    const measurePhases: Array<ProjectorMessageState['measurePhase']> = [
      'idle',
      'countdown',
      'measuring',
      'window-end',
    ];
    const winners: Array<ProjectorMessageState['revealWinner']> = [
      null,
      { name: 'Alpha' },
      { names: ['Alpha', 'Bravo'] },
    ];

    for (const measurePhase of measurePhases) {
      for (const measuringDemoId of [null, 'a', 'orphan']) {
        for (const revealActive of [false, true]) {
          for (const revealWinner of winners) {
            const state: ProjectorMessageState = {
              demos,
              measuringDemoId,
              measurePhase,
              windowSeconds: 8,
              revealActive,
              revealWinner,
            };
            const msg = deriveProjectorMessage(state);
            expect(msg.phase).not.toBe('reveal-buildup');
          }
        }
      }
    }
  });
});
