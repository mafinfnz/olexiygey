import { authorized, body, command, json, newCode, digest, preflight } from '../_lib.js';

const issueCode = `
  redis.call('INCR', KEYS[1])
  redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2])
  redis.call('SET', KEYS[3], '0')
  redis.call('DEL', KEYS[4], KEYS[5], KEYS[6])
  return 1
`;

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  if (!authorized(req)) return json(res, 401, { error: 'unauthorized' });
  try {
    const code = newCode();
    await command('EVAL', issueCode, 6, 'cg:generation', 'cg:active_code', 'cg:locked', 'cg:lock_request_id', 'cg:lock_ack', 'cg:verify_attempts', digest(code), 300);
    return json(res, 200, { code, expiresInSeconds: 300 });
  } catch (error) {
    return json(res, 503, { error: error.message || 'storage unavailable' });
  }
}

