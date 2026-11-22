import { command, json, preflight } from './_lib.js';

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' });
  try {
    await command('PING');
    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, 503, { ok: false, error: error.message || 'storage unavailable' });
  }
}
