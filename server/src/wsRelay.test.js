// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { attachRelay } from './wsRelay.js';

let httpServer;
let baseUrl;

beforeEach(async () => {
  httpServer = createServer();
  attachRelay(httpServer);
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address();
  baseUrl = `ws://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise((resolve) => httpServer.close(resolve));
});

function connectClient(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws) {
  return new Promise((resolve) => {
    ws.once('message', (data) => resolve(data.toString()));
  });
}

describe('wsRelay', () => {
  it('relays message from client A to client B without echo to A', async () => {
    const clientA = await connectClient(baseUrl);
    const clientB = await connectClient(baseUrl);

    const receivedByB = waitForMessage(clientB);
    const echoPromise = new Promise((resolve) => {
      clientA.once('message', () => resolve(true));
      setTimeout(() => resolve(false), 200);
    });

    clientA.send('hello from A');

    const msgB = await receivedByB;
    const gotEcho = await echoPromise;

    expect(msgB).toBe('hello from A');
    expect(gotEcho).toBe(false);

    clientA.close();
    clientB.close();
  });

  it('relays message from A to both B and C', async () => {
    const clientA = await connectClient(baseUrl);
    const clientB = await connectClient(baseUrl);
    const clientC = await connectClient(baseUrl);

    const receivedByB = waitForMessage(clientB);
    const receivedByC = waitForMessage(clientC);

    clientA.send('broadcast');

    const [msgB, msgC] = await Promise.all([receivedByB, receivedByC]);

    expect(msgB).toBe('broadcast');
    expect(msgC).toBe('broadcast');

    clientA.close();
    clientB.close();
    clientC.close();
  });
});
