import { timingSafeEqual, createHash, randomBytes, randomInt } from 'node:crypto';

export const digest = (value) => createHash('sha256').update(value).digest('hex');
export const secureEqual = (left, right) => {
  const a = Buffer.from(left || '');
  const b = Buffer.from(right || '');
  return a.length === b.length && timingSafeEqual(a, b);
};
export const json = (res, status, data) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  return res.status(status).json(data);
};
export const preflight = (req, res) => {
  if (req.method !== 'OPTIONS') return false;
  json(res, 204, {});
  return true;
};
export const body = (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  return {};
};
export const authorized = (req) => {
  const supplied = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const known = [process.env.ADMIN_TOKEN, process.env.OPERATOR_TOKEN].filter(Boolean);
  return known.some((secret) => secureEqual(supplied, secret));
};
export const command = async (...parts) => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Upstash Redis is not configured');
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(parts)
  });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error || 'Redis request failed');
  return result.result;
};
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
export const newSession = () => randomBytes(32).toString('base64url');
