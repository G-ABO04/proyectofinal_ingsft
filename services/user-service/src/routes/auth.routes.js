const { Router } = require('express');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const { hashPassword, verifyPassword, sameSecret } = require('../security');
const { createUser, publicUser } = require('../data/usuarios');
const { schemas, validate, today } = require('../validation');
const { transaction } = require('../database');
const { authenticate } = require('../middleware/auth.middleware');

function authRoutes(db, config) {
  const router = Router();
  const auth = authenticate(db, config);
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: config.loginMax, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Demasiados intentos. Espera 15 minutos antes de volver a intentar.' } });
  router.get('/status', (req, res) => res.json({ setupRequired: db.prepare('SELECT COUNT(*) AS count FROM users').get().count === 0 }));
  router.post('/setup', limiter, validate(schemas.setup), async (req, res) => {
    if (!sameSecret(req.validated.setupToken, config.setupToken)) return res.status(403).json({ error: 'El código de instalación no es válido.' });
    const hash = await hashPassword(req.validated.password);
    const user = transaction(db, () => {
      if (db.prepare('SELECT COUNT(*) AS count FROM users').get().count) return null;
      return createUser(db, { ...req.validated, role: 'Administrador' }, hash);
    });
    if (!user) return res.status(409).json({ error: 'La configuración inicial ya se completó.' });
    res.status(201).json({ user });
  });
  router.post('/login', limiter, validate(schemas.login), async (req, res) => {
    const row = db.prepare('SELECT * FROM users WHERE email=?').get(req.validated.email);
    const valid = await verifyPassword(req.validated.password, row?.password_hash);
    if (!valid || !row.active) return res.status(401).json({ error: 'No se pudo iniciar sesión. Revisa tus credenciales o consulta al administrador.' });
    const id = randomUUID();
    const now = Math.floor(Date.now() / 1000);
    db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now);
    db.prepare('INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)').run(id, row.id, now + config.tokenSeconds);
    db.prepare('UPDATE users SET last_access=? WHERE id=?').run(today(), row.id);
    const accessToken = jwt.sign({}, config.jwtSecret, { algorithm: 'HS256', subject: row.id, jwtid: id, issuer: 'donativoseguro', audience: 'donativoseguro-web', expiresIn: config.tokenSeconds });
    res.json({ accessToken, expiresIn: config.tokenSeconds, user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(row.id)) });
  });
  router.get('/me', auth, (req, res) => res.json({ user: req.user }));
  router.post('/logout', auth, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE id=?').run(req.sessionId);
    res.status(204).end();
  });
  router.put('/profile', auth, validate(schemas.profile), (req, res) => {
    const { name, phone } = req.validated;
    transaction(db, () => {
      db.prepare('UPDATE users SET name=?,phone=? WHERE id=?').run(name, phone, req.user.id);
      db.prepare('UPDATE donors SET name=?,phone=? WHERE account_user_id=?').run(name, phone, req.user.id);
    });
    res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
  });
  return router;
}

module.exports = { authRoutes };
