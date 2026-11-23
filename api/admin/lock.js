import { randomBytes } from 'node:crypto';
import { authorized, command, json, preflight } from '../_lib.js';

const lockState = `
  if redis.call('GET', KEYS[1]) == '1' then
    local requestId = redis.call('GET', KEYS[3]) or ''
    local ack = redis.call('GET', KEYS[4]) or ''
    redis.call('DEL', KEYS[5])
    return {1, requestId, requestId ~= '' and ack == requestId and 1 or 0}
  end
  redis.call('INCR', KEYS[2])
  redis.call('SET', KEYS[1], '1')
  redis.call('SET', KEYS[3], ARGV[1])
  redis.call('DEL', KEYS[4], KEYS[5])
  return {0, ARGV[1], 0}
`;

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  if (!authorized(req)) return json(res, 401, { error: 'unauthorized' });
  try {
    const requestId = randomBytes(16).toString('hex');
    const result = await command('EVAL', lockState, 5, 'cg:locked', 'cg:generation', 'cg:lock_request_id', 'cg:lock_ack', 'cg:active_code', requestId);
    const [alreadyLocked, currentRequestId, acknowledged] = result;
    return json(res, 200, {
      locked: true,
      alreadyLocked: Number(alreadyLocked) === 1,
      requestId: currentRequestId || null,
      acknowledged: Number(acknowledged) === 1
    });
  } catch (error) {
    return json(res, 503, { error: error.message || 'storage unavailable' });
  }
}

