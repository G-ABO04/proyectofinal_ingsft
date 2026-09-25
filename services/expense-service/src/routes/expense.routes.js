const { Router } = require('express');
const { randomUUID } = require('node:crypto');
const { transaction } = require('../database');

function expenseRoutes(db) {
  const router = Router();
  
  // Middleware para verificar si es Admin
  const adminOnly = (req, res, next) => {
    if (req.user.role !== 'Administrador') return res.status(403).json({ error: 'Acceso denegado' });
    next();
  };

  // ----- PROYECTOS -----
  router.get('/projects', (req, res) => {
    const projects = db.prepare('SELECT * FROM projects ORDER BY name ASC').all();
    res.json({ projects });
  });

  router.post('/projects', adminOnly, (req, res) => {
    const { name, budget_cents } = req.body;
    if (!name || typeof budget_cents !== 'number' || budget_cents < 0) {
      return res.status(400).json({ error: 'Datos de proyecto inválidos' });
    }
    const id = randomUUID();
    const created_at = new Date().toISOString();
    try {
      db.prepare('INSERT INTO projects (id, name, budget_cents, created_at) VALUES (?, ?, ?, ?)').run(id, name, budget_cents, created_at);
      res.status(201).json({ project: { id, name, budget_cents, active: 1, created_at } });
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Ya existe un proyecto con ese nombre' });
      throw err;
    }
  });

  // ----- EGRESOS / GASTOS -----
  router.get('/expenses', (req, res) => {
    // Si no es admin, quizá solo ve los egresos que él registró (o todos si la ONG es transparente internamente)
    // Para simplificar, dejaremos que todos vean los gastos.
    const expenses = db.prepare('SELECT e.*, u.name as created_by_name FROM expenses e JOIN users u ON e.created_by_id = u.id ORDER BY seq DESC').all();
    res.json({ expenses });
  });

  router.post('/expenses', (req, res) => {
    const { project_id, amount_cents, category, description, date } = req.body;
    if (!amount_cents || amount_cents <= 0 || !category || !description || !date) {
      return res.status(400).json({ error: 'Faltan datos obligatorios para el gasto' });
    }
    const result = db.prepare('INSERT INTO expenses (project_id, created_by_id, amount_cents, category, description, date) VALUES (?, ?, ?, ?, ?, ?)').run(
      project_id || null, req.user.id, amount_cents, category, description, date
    );
    res.status(201).json({ expense: { seq: result.lastInsertRowid } });
  });

  router.patch('/expenses/:seq/approve', adminOnly, (req, res) => {
    const seq = req.params.seq;
    const expense = db.prepare('SELECT status FROM expenses WHERE seq = ?').get(seq);
    if (!expense) return res.status(404).json({ error: 'Gasto no encontrado' });
    if (expense.status === 'Pagado') return res.status(400).json({ error: 'El gasto ya está pagado' });
    
    db.prepare("UPDATE expenses SET status = 'Pagado', approved_by_id = ?, approved_at = ? WHERE seq = ?").run(
      req.user.id, new Date().toISOString(), seq
    );
    res.status(200).json({ status: 'ok' });
  });

  return router;
}

module.exports = { expenseRoutes };
