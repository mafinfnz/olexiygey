import { body, command, digest, json, newSession, preflight } from './_lib.js';

const consumeCode = `
  local attempts = redis.call('INCR', KEYS[3])
  if attempts == 1 then redis.call('EXPIRE', KEYS[3], ARGV[2]) end
  if attempts > tonumber(ARGV[3]) then return -2 end
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
    const consumed = Number(await command('EVAL', consumeCode, 3, 'cg:active_code', 'cg:locked', 'cg:verify_attempts', digest(code), 300, 10));
    if (consumed === -2) return json(res, 429, { error: 'Слишком много попыток. Запросите новый код.' });
    if (consumed !== 1) return json(res, 401, { error: 'invalid or expired code' });
    const generation = await command('GET', 'cg:generation');
    const token = newSession();
    await command('SET', `cg:session:${digest(token)}`, String(generation || '0'), 'EX', 43200);
    return json(res, 200, { token, expiresInSeconds: 43200 });
  } catch (error) {
    return json(res, 503, { error: error.message || 'storage unavailable' });
  }
}

