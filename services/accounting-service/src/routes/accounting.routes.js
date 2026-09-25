const { Router } = require('express');

function accountingRoutes(db) {
  const router = Router();

  const adminOnly = (req, res, next) => {
    if (req.user.role !== 'Administrador') return res.status(403).json({ error: 'Acceso denegado. Se requiere nivel administrativo para ver finanzas.' });
    next();
  };

  // Balance General Simplificado (Ingresos totales vs Egresos Totales)
  router.get('/balance', adminOnly, (req, res) => {
    // Ingresos: Solo donativos verificados en efectivo
    const incomeRow = db.prepare("SELECT SUM(amount_cents) AS total_income FROM donations WHERE status = 'Verificado' AND type = 'Efectivo'").get();
    // Egresos: Solo gastos pagados
    const expenseRow = db.prepare("SELECT SUM(amount_cents) AS total_expense FROM expenses WHERE status = 'Pagado'").get();
    
    const totalIncome = incomeRow.total_income || 0;
    const totalExpense = expenseRow.total_expense || 0;
    const currentBalance = totalIncome - totalExpense;

    res.json({
      balance: {
        total_income_cents: totalIncome,
        total_expense_cents: totalExpense,
        available_balance_cents: currentBalance
      }
    });
  });

  // Estado de Resultados (Income Statement) agrupado por categorías
  router.get('/income-statement', adminOnly, (req, res) => {
    const incomes = db.prepare("SELECT type, SUM(amount_cents) as total FROM donations WHERE status = 'Verificado' GROUP BY type").all();
    const expenses = db.prepare("SELECT category, SUM(amount_cents) as total FROM expenses WHERE status = 'Pagado' GROUP BY category").all();
    
    res.json({
      income_statement: {
        incomes,
        expenses
      }
    });
  });

  // Resumen Financiero por Proyecto (Fondos Restringidos)
  router.get('/projects-summary', adminOnly, (req, res) => {
    const projects = db.prepare("SELECT id, name, budget_cents FROM projects").all();
    const results = projects.map(p => {
      const inc = db.prepare("SELECT SUM(amount_cents) AS total FROM donations WHERE status = 'Verificado' AND type = 'Efectivo' AND project_id = ?").get(p.id);
      const exp = db.prepare("SELECT SUM(amount_cents) AS total FROM expenses WHERE status = 'Pagado' AND project_id = ?").get(p.id);
      
      const income = inc.total || 0;
      const expense = exp.total || 0;
      return {
        id: p.id,
        name: p.name,
        budget_cents: p.budget_cents,
        income_cents: income,
        expense_cents: expense,
        balance_cents: income - expense
      };
    });

    // Agregar ingresos/egresos no asignados a proyectos (General Fund)
    const incUnassigned = db.prepare("SELECT SUM(amount_cents) AS total FROM donations WHERE status = 'Verificado' AND type = 'Efectivo' AND project_id IS NULL").get();
    const expUnassigned = db.prepare("SELECT SUM(amount_cents) AS total FROM expenses WHERE status = 'Pagado' AND project_id IS NULL").get();
    
    results.push({
      id: 'general-fund',
      name: 'Fondo General (Sin Asignar)',
      budget_cents: 0,
      income_cents: incUnassigned.total || 0,
      expense_cents: expUnassigned.total || 0,
      balance_cents: (incUnassigned.total || 0) - (expUnassigned.total || 0)
    });

    res.json({ projects: results });
  });

  return router;
}

module.exports = { accountingRoutes };
