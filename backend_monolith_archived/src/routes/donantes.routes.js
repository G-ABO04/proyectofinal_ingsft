const { Router } = require('express');
const { randomUUID } = require('node:crypto');
const { schemas, validate, today } = require('../validation');
const { publicDonor } = require('../data/donantes');
const { transaction } = require('../database');
const { adminOnly } = require('../middleware/auth.middleware');

function donorRoutes(db) {
  const router = Router();
  router.use(adminOnly);
  function validOwner(req, res, next) {
    if (req.validated.ownerId && !db.prepare('SELECT id FROM users WHERE id=?').get(req.validated.ownerId)) return res.status(400).json({ error: 'El responsable no existe.' });
    next();
  }
  router.get('/', (req, res) => res.json({ donors: db.prepare('SELECT * FROM donors WHERE deleted_at IS NULL ORDER BY date DESC,id').all().map(publicDonor) }));
  router.get('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM donors WHERE id=? AND deleted_at IS NULL').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Donante no encontrado.' });
    res.json({ donor: publicDonor(row) });
  });
  router.post('/', validate(schemas.donor), validOwner, (req, res) => {
    const input = req.validated, id = randomUUID();
    db.prepare('INSERT INTO donors (id,name,email,phone,person,date,owner_id) VALUES (?,?,?,?,?,?,?)').run(id, input.name, input.email, input.phone, input.person, today(), input.ownerId);
    res.status(201).json({ donor: publicDonor(db.prepare('SELECT * FROM donors WHERE id=?').get(id)) });
  });
  router.put('/:id', validate(schemas.donor), validOwner, (req, res) => {
    const row = db.prepare('SELECT * FROM donors WHERE id=? AND deleted_at IS NULL').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Donante no encontrado.' });
    const input = req.validated;
    if (row.account_user_id && input.ownerId !== row.account_user_id) return res.status(409).json({ error: 'El perfil de un donador no puede transferirse a otra cuenta.' });
    transaction(db, () => {
      db.prepare('UPDATE donors SET name=?,email=?,phone=?,person=?,owner_id=? WHERE id=?').run(input.name, input.email, input.phone, input.person, input.ownerId, row.id);
      if (row.account_user_id) db.prepare('UPDATE users SET name=?,email=?,phone=? WHERE id=?').run(input.name, input.email, input.phone, row.account_user_id);
      if (input.ownerId !== row.owner_id) db.prepare('UPDATE donations SET owner_id=? WHERE donor_id=?').run(input.ownerId, row.id);
    });
    res.json({ donor: publicDonor(db.prepare('SELECT * FROM donors WHERE id=?').get(row.id)) });
  });
  router.delete('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM donors WHERE id=? AND deleted_at IS NULL').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Donante no encontrado.' });
    if (row.account_user_id) return res.status(409).json({ error: 'Este donante tiene una cuenta. Desactívala desde Usuarios si deseas retirar su acceso.' });
    db.prepare('UPDATE donors SET deleted_at=? WHERE id=?').run(today(), row.id);
    res.status(204).end();
  });
  return router;
}

module.exports = { donorRoutes };
