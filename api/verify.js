import { body, command, digest, json, newSession, preflight } from './_lib.js';

const consumeCode = `
  if redis.call('GET', KEYS[2]) == '1' then return 0 end
  local code = redis.call('GET', KEYS[1])
  if not code or code ~= ARGV[1] then return -1 end
  redis.call('DEL', KEYS[1])
  return 1
`;

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  const code = String(body(req).code || '').trim();
  if (!/^\d{6}$/.test(code)) return json(res, 401, { error: 'invalid or expired code' });
  try {
    const consumed = Number(await command('EVAL', consumeCode, 2, 'cg:active_code', 'cg:locked', digest(code)));
    if (consumed !== 1) return json(res, 401, { error: 'invalid or expired code' });
    const generation = await command('GET', 'cg:generation');
    const token = newSession();
    await command('SET', `cg:session:${digest(token)}`, String(generation || '0'), 'EX', 43200);
    return json(res, 200, { token, expiresInSeconds: 43200 });
  } catch (error) {
    return json(res, 503, { error: error.message || 'storage unavailable' });
  }
}
