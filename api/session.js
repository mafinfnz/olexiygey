import { body, command, digest, json, preflight } from './_lib.js';

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  const token = String(body(req).token || '');
  if (!token) return json(res, 401, { valid: false });
  try {
    const [locked, generation, sessionGeneration] = await Promise.all([
      command('GET', 'cg:locked'),
      command('GET', 'cg:generation'),
      command('GET', `cg:session:${digest(token)}`)
    ]);
    if (locked === '1' || !sessionGeneration || sessionGeneration !== (generation || '0')) {
      return json(res, 401, { valid: false, locked: locked === '1' });
    }
    return json(res, 200, { valid: true });
  } catch (error) {
    return json(res, 503, { valid: false, error: error.message || 'storage unavailable' });
  }
}
