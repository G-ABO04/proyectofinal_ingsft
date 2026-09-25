const { Router } = require('express');
const { schemas, validate } = require('../validation');
const { hashPassword } = require('../security');
const { publicUser, createUser } = require('../data/usuarios');
const { adminOnly } = require('../middleware/auth.middleware');
const { transaction } = require('../database');

function userRoutes(db) {
  const router = Router();
  router.use(adminOnly);
  router.get('/', (req, res) => res.json({ users: db.prepare('SELECT * FROM users ORDER BY joined_at,id').all().map(publicUser) }));
  router.post('/', validate(schemas.user), async (req, res) => {
    const hash = await hashPassword(req.validated.password);
    res.status(201).json({ user: createUser(db, req.validated, hash) });
  });
  router.put('/:id', validate(schemas.userUpdate), async (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    const input = req.validated;
    if (user.id === req.user.id && input.role !== 'Administrador') return res.status(409).json({ error: 'No puedes retirar tu propio acceso de administrador.' });
    const passwordHash = input.password ? await hashPassword(input.password) : user.password_hash;
    transaction(db, () => {
      db.prepare('UPDATE users SET name=?,email=?,role=?,password_hash=? WHERE id=?').run(input.name, input.email, input.role, passwordHash, user.id);
      db.prepare('UPDATE donors SET name=?,email=? WHERE account_user_id=?').run(input.name, input.email, user.id);
      if (input.password || input.role !== user.role) db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
    });
    res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)) });
  });
  router.patch('/:id/estado', validate(schemas.state), (req, res) => {
    if (req.params.id === req.user.id && !req.validated.active) return res.status(409).json({ error: 'No puedes desactivar tu propia cuenta.' });
    const result = db.prepare('UPDATE users SET active=? WHERE id=?').run(Number(req.validated.active), req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (!req.validated.active) db.prepare('DELETE FROM sessions WHERE user_id=?').run(req.params.id);
    res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id)) });
  });
  return router;
}

module.exports = { userRoutes };
