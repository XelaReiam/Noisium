// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { serveStatic } from './staticHandler.js';

let distDir;
let server;
let baseUrl;

beforeEach(async () => {
  distDir = await mkdtemp(join(tmpdir(), 'noisium-test-'));
  await writeFile(join(distDir, 'index.html'), '<!DOCTYPE html><html><body>index</body></html>');

  server = createServer((req, res) => serveStatic(distDir, req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(distDir, { recursive: true, force: true });
});

describe('serveStatic', () => {
  it('returns 200 with index.html content for GET /', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('index');
  });

  it('returns 200 SPA fallback for extension-less path /app', async () => {
    const res = await fetch(`${baseUrl}/app`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('index');
  });

  it('returns 404 for missing asset path with file extension', async () => {
    const res = await fetch(`${baseUrl}/assets/index.js`);
    expect(res.status).toBe(404);
  });
});
