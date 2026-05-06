import { createServer } from 'node:http';
import { serveStatic } from './staticHandler.js';
import { attachRelay } from './wsRelay.js';

/**
 * Creates and starts the Noisium companion server.
 *
 * @param {string} distDir  Absolute path to the built app directory.
 * @param {number} port     Port to listen on. Use 0 to let the OS pick a free port.
 * @param {{ lanUrl?: string }} [options]  Optional LAN URL injected into index.html
 *                                         so the host UI can display the projector
 *                                         URL even when loaded from localhost.
 * @returns {Promise<{ server: import('node:http').Server, wss: import('ws').WebSocketServer, port: number }>}
 */
export function createNoisiumServer(distDir, port, options = {}) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => serveStatic(distDir, req, res, options));
    const wss = attachRelay(server);

    server.on('error', reject);
    wss.on('error', reject);

    server.listen(port, '0.0.0.0', () => {
      resolve({ server, wss, port: server.address().port });
    });
  });
}
