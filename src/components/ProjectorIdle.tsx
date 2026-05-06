interface Props {
  /** Optional bottom-corner status text — used for 'calibrating' and 'window-end'. */
  cornerStatus?: string;
}

/**
 * The projector's default screen: big "Noisium" wordmark + subtitle.
 * Used for: idle, calibrating (with cornerStatus="Setting up…"),
 * window-end (with cornerStatus="Thank you.").
 *
 * Black-on-white per 04-RESEARCH.md typography choice — predictable across
 * any projector configuration without dark-mode inversion.
 */
export function ProjectorIdle({ cornerStatus }: Props) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center px-8 relative">
      <h1 className="text-8xl font-bold tracking-tight text-gray-900">Noisium</h1>
      <p className="text-2xl font-light text-gray-500 mt-4">DemoJam applause meter</p>
      {cornerStatus && (
        <p className="fixed bottom-6 right-8 text-sm font-medium text-gray-400">
          {cornerStatus}
        </p>
      )}
    </div>
  );
}
