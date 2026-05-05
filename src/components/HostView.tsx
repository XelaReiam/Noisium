import { CrossDayCheckEffect } from './CrossDayCheckEffect';
import { CrossDayModal } from './CrossDayModal';
import { MicPanel } from './MicPanel';
import { PersistenceBanner } from './PersistenceBanner';
import { WindowPicker } from './WindowPicker';

export function HostView() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PersistenceBanner />
      <CrossDayCheckEffect />
      <CrossDayModal />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-8">
        <h1 className="text-3xl font-semibold text-gray-900">Noisium</h1>

        {/* Centerpiece: mic permission card → mic-live panel on grant */}
        <MicPanel />

        {/* Settings: smaller section below, visible regardless of mic state */}
        <section className="w-full max-w-md">
          <h2 className="text-sm font-medium text-gray-700 mb-2">
            Measurement window
          </h2>
          <WindowPicker />
        </section>
      </main>
    </div>
  );
}
