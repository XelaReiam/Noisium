import { CrossDayCheckEffect } from './CrossDayCheckEffect';
import { CrossDayModal } from './CrossDayModal';
import { MicPanel } from './MicPanel';
import { PersistenceBanner } from './PersistenceBanner';
import { WindowPicker } from './WindowPicker';
import { CalibrateButton } from './CalibrateButton';
import { DemoListEditor } from './DemoListEditor';
import { MeasurementOrchestrator } from './MeasurementOrchestrator';
import { useAppStore } from '../store/useAppStore';

export function HostView() {
  const calibrationAmbientDb = useAppStore((s) => s.calibrationAmbientDb);
  const startMeasure = useAppStore((s) => s.startMeasure);

  // The DemoListEditor's "Measure" buttons call back here. We just delegate
  // to the store; the MeasurementOrchestrator picks up the measuringDemoId
  // change automatically and runs the countdown→engine→completeMeasure flow.
  const handleMeasure = (demoId: string): void => {
    startMeasure(demoId);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PersistenceBanner />
      <CrossDayCheckEffect />
      <CrossDayModal />

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

        {/* Render-effect components — invisible, but MeasurementOrchestrator
            renders the countdown overlay (absolute inset-0) when measuring. */}
        <MeasurementOrchestrator />
      </main>
    </div>
  );
}
