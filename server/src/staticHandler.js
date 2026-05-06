import { createReadStream, promises as fsp } from 'node:fs';
import { join, extname } from 'node:path';
import { lookup } from 'mime-types';

/**
 * Serves static files from distDir with SPA fallback.
 *
 * - If the file exists: serve it with correct Content-Type.
 * - If the file is missing AND the path has a file extension: 404.
 * - If the file is missing AND the path has NO extension: serve index.html (SPA fallback).
 * - Root path '/' always resolves to index.html.
 *
 * @param {string} distDir  Absolute path to the built app directory.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export async function serveStatic(distDir, req, res) {
  // Strip query string and decode
  const rawUrl = req.url ?? '/';
  const urlPath = rawUrl.split('?')[0];

  // Resolve the file path
  const normalizedPath = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = join(distDir, normalizedPath);

  // Check if file exists
  const exists = await fsp.access(filePath).then(() => true).catch(() => false);

  if (exists) {
    const contentType = lookup(filePath) || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    createReadStream(filePath).pipe(res);
    return;
  }

  // File does not exist — decide: 404 or SPA fallback
  if (extname(urlPath) !== '') {
    // Has extension but file missing → 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }

  // No extension → SPA fallback
  const indexPath = join(distDir, 'index.html');
  const contentType = 'text/html';
  res.writeHead(200, { 'Content-Type': contentType });
  createReadStream(indexPath).pipe(res);
}
