import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';

const root = fileURLToPath(new URL('.', import.meta.url));
const dataDirectory = join(root, 'data');
const historyFile = join(dataDirectory, 'print-history.json');
const printerConfigFile = join(dataDirectory, 'printer-config.json');
const adminFile = join(dataDirectory, 'admin.json');
const port = Number(process.env.PORT || 8080);
const sessions = new Set();
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };

async function readJsonFile(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch { return fallback; }
}

async function readHistory() {
  try {
    const value = JSON.parse(await readFile(historyFile, 'utf8'));
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

async function writePrinterConfig(printers) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(printerConfigFile, `${JSON.stringify(printers, null, 2)}\n`, 'utf8');
}

async function writeAdmin(admin) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(adminFile, `${JSON.stringify(admin, null, 2)}\n`, 'utf8');
}

function validPin(pin) { return /^\d{4,8}$/.test(String(pin || '')); }

function isAuthorized(request) {
  const header = request.headers.authorization || '';
  return header.startsWith('Bearer ') && sessions.has(header.slice(7));
}

function newSession() {
  const token = randomBytes(24).toString('hex');
  sessions.add(token);
  return token;
}

function sanitizePrinters(printers) {
  if (!Array.isArray(printers)) return null;
  return printers.slice(0, 100).map((printer, index) => ({
    id: String(printer?.id || `printer-${index + 1}`).slice(0, 100),
    name: String(printer?.name || `Printer ${index + 1}`).trim().slice(0, 80),
    host: String(printer?.host || '').trim().slice(0, 253),
    port: Number(printer?.port),
    color: /^#[\da-f]{6}$/i.test(String(printer?.color || '')) ? String(printer.color) : '#4c325b'
  })).filter(printer => printer.name && /^[a-zA-Z0-9.-]{1,253}$/.test(printer.host) && Number.isInteger(printer.port) && printer.port >= 1 && printer.port <= 65535);
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
    if (request.url === '/api/printer-config' && request.method === 'GET') {
      const printers = await readJsonFile(printerConfigFile, null);
      return json(response, 200, { printers: Array.isArray(printers) ? sanitizePrinters(printers) : null });
    }
    if (request.url === '/api/printer-config' && request.method === 'PUT') {
      const payload = await body(request);
      const printers = sanitizePrinters(payload.printers);
      if (!printers) return json(response, 400, { error: 'Invalid printer configuration' });
      if (!isAuthorized(request)) return json(response, 401, { error: 'Admin login required' });
      await writePrinterConfig(printers);
      return json(response, 200, { ok: true, printers });
    }
    if (request.url === '/api/admin-auth' && request.method === 'GET') {
      const admin = await readJsonFile(adminFile, {});
      return json(response, 200, { configured: Boolean(admin.pinHash) });
    }
    if (request.url === '/api/admin-auth' && request.method === 'POST') {
      const payload = await body(request);
      const admin = await readJsonFile(adminFile, {});
      if (payload.action === 'setup') {
        if (admin.pinHash) return json(response, 409, { error: 'Admin code already configured' });
        if (!validPin(payload.pin)) return json(response, 400, { error: 'Invalid admin code' });
        await writeAdmin({ pinHash: createHash('sha256').update(String(payload.pin)).digest('hex') });
        return json(response, 201, { ok: true, token: newSession() });
      }
      if (payload.action === 'login') {
        const { createHash } = await import('node:crypto');
        const pinHash = createHash('sha256').update(String(payload.pin || '')).digest('hex');
        const ok = Boolean(admin.pinHash && pinHash === admin.pinHash);
        return json(response, 200, { configured: Boolean(admin.pinHash), ok, token: ok ? newSession() : null });
      }
      return json(response, 400, { error: 'Unknown auth action' });
    }
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
      if (!isAuthorized(request)) return json(response, 401, { error: 'Admin login required' });
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
