import { ConfettiCanvas } from './ConfettiCanvas';

interface Props {
  winner: { name: string } | { names: string[] };
  /** Internal projector state: 'buildup' for ~2.5s, then 'name' for the rest. */
  displayPhase: 'buildup' | 'name';
}

/**
 * Two-phase reveal animation. Buildup state shows "And the winner is…"
 * (or "Tied for the win:" for ties); name state fades in the big name(s).
 *
 * Tie semantics: when winner has `names: string[]`, both phases use the
 * tie-aware copy/layout. The single-vs-tie distinction is made by checking
 * `'names' in winner` — TypeScript narrows the union.
 */
export function ProjectorReveal({ winner, displayPhase }: Props) {
  const isTie = 'names' in winner;
  const buildupText = isTie ? 'Tied for the win:' : 'And the winner is…';

  return (
    <div
      className="min-h-screen bg-white flex flex-col items-center justify-center px-16 text-center"
      style={{ position: 'relative' }}
    >
      <ConfettiCanvas active={displayPhase === 'name'} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {displayPhase === 'buildup' && (
          <p className="text-5xl font-light text-gray-600 italic">{buildupText}</p>
        )}
        {displayPhase === 'name' && (
          <>
            {isTie ? (
              <>
                <p className="text-4xl font-light text-gray-600 mb-12">{buildupText}</p>
                <div className="flex flex-wrap gap-12 justify-center">
                  {winner.names.map((n) => (
                    <p
                      key={n}
                      className="text-7xl font-black text-gray-900"
                      style={{
                        animation: 'noisium-fade-in 0.6s ease-out forwards',
                      }}
                    >
                      {n}
                    </p>
                  ))}
                </div>
              </>
            ) : (
              <p
                className="text-9xl font-black text-gray-900"
                style={{
                  animation: 'noisium-fade-in 0.6s ease-out forwards',
                }}
              >
                {winner.name}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
