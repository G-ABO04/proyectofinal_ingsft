const { Router } = require('express');
const { randomUUID } = require('node:crypto');
const { transaction } = require('../database');

function taxRoutes(db) {
  const router = Router();
  
  const adminOnly = (req, res, next) => {
    if (req.user.role !== 'Administrador') return res.status(403).json({ error: 'Acceso denegado' });
    next();
  };

  // Listar recibos generados
  router.get('/receipts', adminOnly, (req, res) => {
    const receipts = db.prepare('SELECT t.*, d.name AS donor_name FROM tax_receipts t JOIN donors d ON t.donor_id = d.id ORDER BY t.created_at DESC').all();
    res.json({ receipts });
  });

  // Emitir un nuevo recibo fiscal para un donativo verificado
  router.post('/emit/:donationSeq', adminOnly, (req, res) => {
    const { donationSeq } = req.params;
    
    // Verificar que el donativo existe y está verificado
    const donation = db.prepare('SELECT * FROM donations WHERE seq = ?').get(donationSeq);
    if (!donation) return res.status(404).json({ error: 'Donativo no encontrado.' });
    if (donation.status !== 'Verificado') return res.status(400).json({ error: 'Solo se pueden emitir recibos de donativos verificados.' });
    if (donation.type !== 'Efectivo') return res.status(400).json({ error: 'Solo los donativos en efectivo son deducibles en este momento.' });

    // Verificar datos fiscales del donante
    const donor = db.prepare('SELECT * FROM donors WHERE id = ?').get(donation.donor_id);
    if (!donor.tax_id || !donor.zip_code || !donor.tax_regime) {
      return res.status(400).json({ error: 'El donante no tiene sus datos fiscales completos (RFC, CP, Régimen).' });
    }

    // Verificar si ya se emitió
    const existing = db.prepare('SELECT * FROM tax_receipts WHERE donation_seq = ?').get(donationSeq);
    if (existing && existing.status === 'Generado') {
      return res.status(400).json({ error: 'Ya existe un recibo generado para este donativo.', receipt: existing });
    }

    try {
      // Simulador de llamada a API del SAT o PAC (Mock)
      const uuid_fiscal = randomUUID().toUpperCase(); // UUID oficial simulado
      const id = randomUUID();
      const created_at = new Date().toISOString();

      db.prepare('INSERT INTO tax_receipts (id, donation_seq, donor_id, tax_id, amount_cents, uuid_fiscal, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        id, donation.seq, donor.id, donor.tax_id, donation.amount_cents, uuid_fiscal, created_at
      );

      res.status(201).json({ 
        message: 'Recibo deducible generado exitosamente.',
        receipt: { id, uuid_fiscal, amount_cents: donation.amount_cents, tax_id: donor.tax_id, created_at } 
      });
    } catch (error) {
      res.status(500).json({ error: 'Ocurrió un error al intentar timbrar el recibo.' });
    }
  });

  // Cancelar un recibo (Mock)
  router.patch('/cancel/:receiptId', adminOnly, (req, res) => {
    const { receiptId } = req.params;
    const receipt = db.prepare('SELECT * FROM tax_receipts WHERE id = ?').get(receiptId);
    if (!receipt) return res.status(404).json({ error: 'Recibo no encontrado.' });
    if (receipt.status === 'Cancelado') return res.status(400).json({ error: 'El recibo ya está cancelado.' });

    db.prepare("UPDATE tax_receipts SET status = 'Cancelado' WHERE id = ?").run(receiptId);
    res.json({ message: 'Recibo cancelado en el sistema fiscal simulado.' });
  });

  return router;
}

module.exports = { taxRoutes };
