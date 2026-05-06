#!/usr/bin/env node
import { join } from 'node:path';
import { createNoisiumServer } from './src/server.js';
import { getLanIp } from './src/lanIp.js';

const DIST_DIR = join(import.meta.dirname, '..', 'dist-lan');
const PORT = Number(process.env.PORT ?? 4000);

createNoisiumServer(DIST_DIR, PORT)
  .then(({ port }) => {
    const ip = getLanIp();
    const url = `http://${ip}:${port}`;
    console.log(`Noisium running at ${url}`);
    console.log(`Projector URL:    ${url}/#/projector`);
  })
  .catch((err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Error: Port ${PORT} is already in use. Set PORT env var to use a different port.`);
      process.exit(1);
    }
    throw err;
  });
