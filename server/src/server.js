import { createServer } from 'node:http';
import { serveStatic } from './staticHandler.js';
import { attachRelay } from './wsRelay.js';

/**
 * Creates and starts the Noisium companion server.
 *
 * @param {string} distDir  Absolute path to the built app directory.
 * @param {number} port     Port to listen on. Use 0 to let the OS pick a free port.
 * @returns {Promise<{ server: import('node:http').Server, wss: import('ws').WebSocketServer, port: number }>}
 */
export function createNoisiumServer(distDir, port) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => serveStatic(distDir, req, res));
    const wss = attachRelay(server);

    server.on('error', reject);
    wss.on('error', reject);

    server.listen(port, '127.0.0.1', () => {
      resolve({ server, wss, port: server.address().port });
    });
  });
}
