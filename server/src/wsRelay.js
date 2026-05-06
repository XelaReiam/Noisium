import { WebSocketServer, WebSocket } from 'ws';

/**
 * Attaches a WebSocket relay to an existing HTTP server.
 * Each incoming message is broadcast to ALL other connected clients.
 * The sender does NOT receive its own message (no echo).
 *
 * @param {import('node:http').Server} httpServer
 * @returns {WebSocketServer}
 */
export function attachRelay(httpServer) {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    ws.on('message', (data, isBinary) => {
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(data, { binary: isBinary });
        }
      });
    });
  });

  return wss;
}
