// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createNoisiumServer } from './server.js';

let serverResult;
let distDir;

afterEach(async () => {
  if (serverResult?.server) {
    await new Promise((resolve) => serverResult.server.close(resolve));
    serverResult = null;
  }
  if (distDir) {
    await rm(distDir, { recursive: true, force: true });
    distDir = null;
  }
});

async function makeTempDist() {
  const dir = await mkdtemp(join(tmpdir(), 'noisium-server-test-'));
  await writeFile(join(dir, 'index.html'), '<!DOCTYPE html><html><body>app</body></html>');
  return dir;
}

describe('createNoisiumServer', () => {
  it('resolves with a bound server on an assigned port when port is 0', async () => {
    distDir = await makeTempDist();
    serverResult = await createNoisiumServer(distDir, 0);
    expect(serverResult.server).toBeDefined();
    expect(serverResult.port).toBeGreaterThan(0);
  });

  it('GET / returns 200', async () => {
    distDir = await makeTempDist();
    serverResult = await createNoisiumServer(distDir, 0);
    const res = await fetch(`http://127.0.0.1:${serverResult.port}/`);
    expect(res.status).toBe(200);
  });

  it('binds to the specified port when port is given', async () => {
    distDir = await makeTempDist();
    serverResult = await createNoisiumServer(distDir, 5001);
    expect(serverResult.port).toBe(5001);
  });

  it('listens on 0.0.0.0 (all interfaces), not 127.0.0.1 only', async () => {
    distDir = await makeTempDist();
    serverResult = await createNoisiumServer(distDir, 0);
    expect(serverResult.server.address().address).toBe('0.0.0.0');
  });
});
