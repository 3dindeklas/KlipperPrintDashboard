import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const dataDirectory = join(root, 'data');
const historyFile = join(dataDirectory, 'print-history.json');
const port = Number(process.env.PORT || 8080);
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };

async function readHistory() {
  try {
    const value = JSON.parse(await readFile(historyFile, 'utf8'));
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

async function writeHistory(entries) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(historyFile, `${JSON.stringify(entries.slice(0, 2000), null, 2)}\n`, 'utf8');
}

function json(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

async function body(request) {
  let value = '';
  for await (const chunk of request) value += chunk;
  return JSON.parse(value || '{}');
}

async function serveStatic(request, response) {
  const requestPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const filePath = normalize(join(root, relative));
  if (!filePath.startsWith(root)) return json(response, 403, { error: 'Forbidden' });
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    createReadStream(filePath).pipe(response);
  } catch { json(response, 404, { error: 'Not found' }); }
}

const server = createServer(async (request, response) => {
  try {
    if (request.url === '/api/print-history' && request.method === 'GET') return json(response, 200, { entries: await readHistory() });
    if (request.url === '/api/print-history' && request.method === 'POST') {
      const entry = await body(request);
      if (!/^[A-Z]$/.test(entry.letter || '') || typeof entry.printerName !== 'string' || typeof entry.printedAt !== 'string') return json(response, 400, { error: 'Invalid print entry' });
      const entries = await readHistory();
      entries.unshift({ id: String(entry.id || `print-${Date.now()}`), printerId: String(entry.printerId || ''), printerName: entry.printerName.slice(0, 80), letter: entry.letter, printedAt: entry.printedAt });
      await writeHistory(entries);
      return json(response, 201, { ok: true });
    }
    if (request.url === '/api/print-history' && request.method === 'DELETE') {
      await writeHistory([]);
      return json(response, 200, { ok: true });
    }
    return serveStatic(request, response);
  } catch (error) {
    console.error(error);
    return json(response, 500, { error: 'Server error' });
  }
});

server.listen(port, '0.0.0.0', () => console.log(`Klipper Print Dashboard listening on ${port}`));
