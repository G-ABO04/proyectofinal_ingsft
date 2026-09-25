const { scrypt, randomBytes, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const derive = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64);
  return `scrypt:${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  const [, salt, expected] = (encoded || '').split(':');
  const key = await derive(password, salt || 'missing-account', 64);
  const saved = Buffer.from(expected || '', 'hex');
  return saved.length === key.length && timingSafeEqual(saved, key);
}

function sameSecret(actual, expected) {
  const a = Buffer.from(actual || '');
  const b = Buffer.from(expected || '');
  return b.length >= 32 && a.length === b.length && timingSafeEqual(a, b);
}

module.exports = { hashPassword, verifyPassword, sameSecret };
