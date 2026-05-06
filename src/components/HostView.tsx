import { useState } from 'react';
import { CrossDayCheckEffect } from './CrossDayCheckEffect';
import { CrossDayModal } from './CrossDayModal';
import { MicPanel } from './MicPanel';
import { PersistenceBanner } from './PersistenceBanner';
import { WindowPicker } from './WindowPicker';
import { CalibrateButton } from './CalibrateButton';
import { DemoListEditor } from './DemoListEditor';
import { MeasurementOrchestrator } from './MeasurementOrchestrator';
import { BroadcastBridge } from './BroadcastBridge';
import { ProjectorToolbar } from './ProjectorToolbar';
import { useAppStore } from '../store/useAppStore';
import { canRevealWinner } from '../lib/projector';
import { clsx } from 'clsx';

export function HostView() {
  const calibrationAmbientDb = useAppStore((s) => s.calibrationAmbientDb);
  const startMeasure = useAppStore((s) => s.startMeasure);
  // Phase 4 reads:
  const demos = useAppStore((s) => s.demos);
  const scores = useAppStore((s) => s.scores);
  const skippedDemoIds = useAppStore((s) => s.skippedDemoIds);
  const revealActive = useAppStore((s) => s.revealActive);
  const triggerReveal = useAppStore((s) => s.triggerReveal);
  const resetReveal = useAppStore((s) => s.resetReveal);
  const clearSession = useAppStore((s) => s.clearSession);

  const [newEventConfirming, setNewEventConfirming] = useState(false);
  const hasSessionData = demos.length > 0 || Object.keys(scores).length > 0;

  // The DemoListEditor's "Measure" buttons call back here. We just delegate
  // to the store; the MeasurementOrchestrator picks up the measuringDemoId
  // change automatically and runs the countdown→engine→completeMeasure flow.
  const handleMeasure = (demoId: string): void => {
    startMeasure(demoId);
  };

  const canReveal = canRevealWinner(demos, scores, skippedDemoIds);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PersistenceBanner />
      <CrossDayCheckEffect />
      <CrossDayModal />
      {/* Phase 4: render-null host-side broadcast relay */}
      <BroadcastBridge />

      {/* Phase 4: header strip with projector toolbar */}
      <header className="px-4 py-2 border-b border-gray-100 flex justify-end">
        <ProjectorToolbar />
      </header>

      {/*
        Main area is `relative` so MeasurementOrchestrator's CountdownOverlay
        (absolute inset-0) covers exactly this region. The persistence banner
        above main remains visible — intentional, host always needs to know
        if storage is broken.
      */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-8 relative">
        <h1 className="text-3xl font-semibold text-gray-900">Noisium</h1>

        {/* Centerpiece: mic permission card → mic-live panel on grant */}
        <MicPanel />

        {/* Phase 3: calibrate-room button below the mic panel */}
        <CalibrateButton />

        {/* Settings section: window length + demo list, side by side on wide
            viewports, stacked on narrow. */}
        <section className="w-full max-w-2xl flex flex-col md:flex-row gap-6 items-start justify-center">
          <div className="flex-1 max-w-md">
            <h2 className="text-sm font-medium text-gray-700 mb-2">
              Measurement window
            </h2>
            <WindowPicker />
          </div>

          <div className="flex-1 max-w-md">
            <DemoListEditor
              onMeasure={handleMeasure}
              calibrationMissing={calibrationAmbientDb === null}
            />
          </div>
        </section>

        {/* Phase 4: Reveal winner button — gated by canRevealWinner */}
        <div className="flex flex-col items-center gap-2 mt-2">
          <button
            type="button"
            onClick={triggerReveal}
            disabled={!canReveal || revealActive}
            className={clsx(
              'px-6 py-3 rounded text-base font-semibold transition-colors',
              !canReveal || revealActive
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-900 text-white hover:bg-gray-800',
            )}
          >
            Reveal winner
          </button>
          {!canReveal && !revealActive && demos.length > 0 && (
            <p className="text-xs text-gray-500">
              Measure every non-skipped demo to enable reveal.
            </p>
          )}
        </div>

        {/* New event — available any time there's session data, with confirmation */}
        {hasSessionData && !revealActive && (
          <div className="flex items-center gap-3">
            {newEventConfirming ? (
              <>
                <span className="text-sm text-gray-700">Clear all demos and scores?</span>
                <button
                  type="button"
                  onClick={() => { clearSession(); setNewEventConfirming(false); }}
                  className="px-3 py-1.5 rounded bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setNewEventConfirming(false)}
                  className="px-3 py-1.5 rounded border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setNewEventConfirming(true)}
                className="px-4 py-2 rounded border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                New event
              </button>
            )}
          </div>
        )}

        {/* Post-reveal: reset reveal state, keep demo list */}
        {revealActive && (
          <button
            type="button"
            onClick={resetReveal}
            className="px-4 py-2 rounded border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reset / New event
          </button>
        )}

        {/* Render-effect components — invisible, but MeasurementOrchestrator
            renders the countdown overlay (absolute inset-0) when measuring. */}
        <MeasurementOrchestrator />
      </main>
    </div>
  );
}
