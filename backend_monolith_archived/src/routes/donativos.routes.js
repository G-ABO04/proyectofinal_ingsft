const { Router } = require('express');
const { schemas, validate, today } = require('../validation');
const { personalDonor } = require('../data/donantes');
const { transaction } = require('../database');
const { adminOnly } = require('../middleware/auth.middleware');

const select = `SELECT n.*, d.name AS donor_name, u.name AS registered_by, v.name AS verified_by FROM donations n JOIN donors d ON d.id=n.donor_id JOIN users u ON u.id=n.created_by_id LEFT JOIN users v ON v.id=n.verified_by_id`;
function publicDonation(row, admin) {
  const result = { id: `DON-${String(row.seq).padStart(4,'0')}`, type: row.type, amount: row.amount_cents / 100, description: row.description, date: row.date, notes: row.notes, status: row.status, verifiedAt: row.verified_at };
  if (admin) Object.assign(result, { donorId: row.donor_id, donorName: row.donor_name, ownerId: row.owner_id, createdById: row.created_by_id, registeredBy: row.registered_by, verifiedBy: row.verified_by });
  return result;
}

function donationRoutes(db) {
  const router = Router();
  const isAdmin = (req) => req.user.role === 'Administrador';
  function find(req) {
    if (!/^DON-\d+$/.test(req.params.id)) return null;
    const row = db.prepare(`${select} WHERE n.seq=?`).get(Number(req.params.id.slice(4)));
    return row && (isAdmin(req) || row.owner_id === req.user.id) ? row : null;
  }
  router.get('/', (req, res) => {
    const rows = isAdmin(req) ? db.prepare(`${select} ORDER BY n.date DESC,n.seq DESC`).all() : db.prepare(`${select} WHERE n.owner_id=? ORDER BY n.date DESC,n.seq DESC`).all(req.user.id);
    res.json({ donations: rows.map((row) => publicDonation(row, isAdmin(req))) });
  });
  router.get('/:id', (req, res) => {
    const row = find(req);
    if (!row) return res.status(404).json({ error: 'Donativo no encontrado.' });
    res.json({ donation: publicDonation(row, isAdmin(req)) });
  });
  router.post('/', validate(schemas.donation), (req, res) => {
    const input = req.validated;
    if (!isAdmin(req) && input.donorId) return res.status(403).json({ error: 'Tu aportación debe registrarse a tu nombre.' });
    const donation = transaction(db, () => {
      const donor = isAdmin(req) ? db.prepare('SELECT * FROM donors WHERE id=? AND deleted_at IS NULL').get(input.donorId || '') : personalDonor(db, req.user);
      if (!donor) return null;
      const result = db.prepare('INSERT INTO donations (donor_id,owner_id,created_by_id,type,amount_cents,description,date,notes) VALUES (?,?,?,?,?,?,?,?)').run(donor.id, donor.owner_id, req.user.id, input.type, input.type === 'Efectivo' ? Math.round(input.amount * 100) : 0, input.type === 'Especie' ? input.description : '', input.date, input.notes);
      return db.prepare(`${select} WHERE n.seq=?`).get(Number(result.lastInsertRowid));
    });
    if (!donation) return res.status(400).json({ error: 'Selecciona un donante disponible.' });
    res.status(201).json({ donation: publicDonation(donation, isAdmin(req)) });
  });
  router.patch('/:id/verificar', adminOnly, (req, res) => {
    const row = find(req);
    if (!row) return res.status(404).json({ error: 'Donativo no encontrado.' });
    if (row.status === 'Registrado') db.prepare("UPDATE donations SET status='Verificado',verified_by_id=?,verified_at=? WHERE seq=?").run(req.user.id, today(), row.seq);
    res.json({ donation: publicDonation(db.prepare(`${select} WHERE n.seq=?`).get(row.seq), true) });
  });
  return router;
}

module.exports = { donationRoutes, publicDonation };
