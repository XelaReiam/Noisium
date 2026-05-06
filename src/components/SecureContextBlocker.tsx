import type { ReactNode } from 'react';

const HTTPS_URL = 'https://xelareiam.github.io/Noisium/';

function isRunningOnHTTP(): boolean {
  if (window.isSecureContext) return false;
  const { hostname, hash } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
    return false;
  }
  // Projector tab served over plain HTTP on LAN is valid — no mic needed
  if (hash.startsWith('#/projector')) return false;
  return true;
}

export function SecureContextBlocker({ children }: { children: ReactNode }) {
  if (!isRunningOnHTTP()) return <>{children}</>;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white p-8 text-center">
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">HTTPS Required</h1>
      <p className="text-gray-700 mb-6 max-w-md">
        Noisium needs HTTPS to access the microphone. Open the deployed URL:
      </p>
      <a
        href={HTTPS_URL}
        className="text-blue-600 underline font-mono text-sm break-all"
      >
        {HTTPS_URL}
      </a>
    </div>
  );
}
