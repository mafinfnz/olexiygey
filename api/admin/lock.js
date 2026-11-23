import { randomBytes } from 'node:crypto';
import { authorized, command, json, preflight } from '../_lib.js';

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  if (!authorized(req)) return json(res, 401, { error: 'unauthorized' });
  try {
    const locked = await command('GET', 'cg:locked');
    if (locked === '1') {
      const requestId = await command('GET', 'cg:lock_request_id');
      const acknowledged = requestId ? await command('GET', 'cg:lock_ack') === requestId : false;
      await command('DEL', 'cg:active_code');
      return json(res, 200, { locked: true, alreadyLocked: true, requestId: requestId || null, acknowledged });
    }

    const requestId = randomBytes(16).toString('hex');
    await command('INCR', 'cg:generation');
    await command('SET', 'cg:locked', '1');
    await command('SET', 'cg:lock_request_id', requestId);
    await command('DEL', 'cg:lock_ack');
    await command('DEL', 'cg:active_code');
    return json(res, 200, { locked: true, requestId });
  } catch (error) {
    return json(res, 503, { error: error.message || 'storage unavailable' });
  }
}

