import { authorized, command, json, preflight } from '../_lib.js';

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  if (!authorized(req)) return json(res, 401, { error: 'unauthorized' });
  try {
    await command('INCR', 'cg:generation');
    await command('SET', 'cg:locked', '1');
    await command('DEL', 'cg:active_code');
    return json(res, 200, { locked: true });
  } catch (error) {
    return json(res, 503, { error: error.message || 'storage unavailable' });
  }
}
