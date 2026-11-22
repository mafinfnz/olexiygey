import { createServer } from 'node:http';
import { randomInt, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || 8787);
const adminToken = process.env.ADMIN_TOKEN;
const operatorToken = process.env.OPERATOR_TOKEN || '';
if (!adminToken || adminToken.length < 24) {
  console.error('Set ADMIN_TOKEN to a random secret of at least 24 characters.');
  process.exit(1);
}
if (operatorToken && (operatorToken.length < 24 || operatorToken === adminToken)) {
  console.error('OPERATOR_TOKEN must be a different secret of at least 24 characters.');
  process.exit(1);
}
const codes = new Map();
const sessions = new Map();
let systemLocked = false;
const digest = (s) => createHash('sha256').update(s).digest('hex');
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((resolve, reject) => {
  let data = ''; req.on('data', c => { data += c; if (data.length > 4096) reject(new Error('too large')); });
  req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('bad json')); } });
});
const equal = (a, b) => { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

createServer(async (req, res) => {
  const route = req.url.replace(/^\/api/, '');
  if (req.method === 'GET' && (route === '/health' || route === '/api/health')) {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (req.method === 'GET' && route === '/admin') {
    try {
      const page = await readFile(fileURLToPath(new URL('./admin.html', import.meta.url)));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(page);
    } catch { res.writeHead(500); return res.end('Admin page unavailable'); }
  }
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, authorization' }); return res.end(); }
  try {
    if (req.method !== 'POST') return json(res, 404, { error: 'not found' });
    const body = await readBody(req);
    if (route === '/admin/code' || route === '/admin/lock') {
      const supplied = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (![adminToken, operatorToken].filter(Boolean).some((known) => equal(supplied, known))) return json(res, 401, { error: 'unauthorized' });
      if (route === '/admin/lock') {
        systemLocked = true;
        codes.clear();
        sessions.clear();
        return json(res, 200, { locked: true });
      }
      systemLocked = false;
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      codes.set(digest(code), Date.now() + 5 * 60_000);
      return json(res, 200, { code, expiresInSeconds: 300 });
    }
    if (route === '/verify') {
      const code = String(body.code || '').trim();
      if (!/^\d{6}$/.test(code)) return json(res, 401, { error: 'invalid or expired code' });
      const key = digest(code); const expires = codes.get(key);
      if (!expires || expires < Date.now()) { codes.delete(key); return json(res, 401, { error: 'invalid or expired code' }); }
      codes.delete(key);
      const token = randomBytes(32).toString('base64url');
      sessions.set(digest(token), Date.now() + 12 * 60 * 60_000);
      return json(res, 200, { token, expiresInSeconds: 43200 });
    }
    if (route === '/session') {
      if (systemLocked) return json(res, 401, { valid: false, locked: true });
      const token = String(body.token || ''); const exp = sessions.get(digest(token));
      if (exp && exp > Date.now()) return json(res, 200, { valid: true });
      sessions.delete(digest(token)); return json(res, 401, { valid: false });
    }
    return json(res, 404, { error: 'not found' });
  } catch { return json(res, 400, { error: 'bad request' }); }
}).listen(port, '0.0.0.0', () => console.log(`Code gate server listening on :${port}`));
