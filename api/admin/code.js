import { authorized, body, command, json, newCode, digest, preflight } from '../_lib.js';

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  if (!authorized(req)) return json(res, 401, { error: 'unauthorized' });
  try {
    const code = newCode();
    await command('INCR', 'cg:generation');
    await command('SET', 'cg:active_code', digest(code), 'EX', 300);
    await command('SET', 'cg:locked', '0');
    return json(res, 200, { code, expiresInSeconds: 300 });
  } catch (error) {
    return json(res, 503, { error: error.message || 'storage unavailable' });
  }
}
